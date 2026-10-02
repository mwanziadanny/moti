// Inventory filters live in the URL. This module is the only place that knows how
// filters map to query parameters, so links, bookmarks and SSR all agree.
import { CONDITIONS, IMPORT_STATUSES, PRICE_PRESETS, SELLER_TYPES, SORT_OPTIONS } from './constants'
import { formatCompactKES, formatNumber } from './format'

export const FILTER_KEYS = [
  'q', 'location', 'condition', 'import', 'minPrice', 'maxPrice', 'minYear', 'maxYear',
  'make', 'model', 'body', 'fuel', 'transmission', 'drive', 'minEngine', 'maxEngine',
  'maxMileage', 'sellerType', 'features', 'availability', 'verified', 'dealer', 'sort', 'page',
]

const MULTI_KEYS = new Set(['features'])
export const DEFAULT_SORT = 'newest'

export function parseFilters(searchParams, base = {}) {
  const f = { ...base }
  for (const key of FILTER_KEYS) {
    const v = searchParams.get(key)
    if (v == null || v === '') continue
    f[key] = MULTI_KEYS.has(key) ? v.split(',').filter(Boolean) : v
  }
  if (f.sort && !SORT_OPTIONS.some((s) => s.value === f.sort)) delete f.sort
  return f
}

export function toSearchParams(filters, omit = {}) {
  const sp = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    let v = filters[key]
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (key === 'page' && Number(v) <= 1) continue
    if (key === 'sort' && v === DEFAULT_SORT) continue
    if (omit[key] != null && String(omit[key]) === String(v)) continue
    sp.set(key, Array.isArray(v) ? v.join(',') : String(v))
  }
  return sp
}

export function carsUrl(filters = {}) {
  const qs = toSearchParams(filters).toString()
  return qs ? `/cars?${qs}` : '/cars'
}

export function countActiveFilters(filters) {
  return FILTER_KEYS.filter((k) => !['sort', 'page', 'q'].includes(k)).reduce((n, k) => {
    const v = filters[k]
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return n
    if (k === 'minPrice' && filters.maxPrice) return n // a price range counts once
    if (k === 'minYear' && filters.maxYear) return n
    if (k === 'minEngine' && filters.maxEngine) return n
    return n + 1
  }, 0)
}

export const pricePreset = (slug) => PRICE_PRESETS.find((p) => p.slug === slug)

const rangeLabel = (min, max, fmt, unit = '') => {
  if (min && max) return `${fmt(min)} – ${fmt(max)}${unit}`
  if (min) return `From ${fmt(min)}${unit}`
  return `Up to ${fmt(max)}${unit}`
}

/** Removable chips describing the active filters. */
export function filterChips(filters, taxonomy) {
  const chips = []
  const drop = (...keys) => (f) => {
    const next = { ...f }
    keys.forEach((k) => delete next[k])
    delete next.page
    return next
  }
  const brand = taxonomy?.brands?.find((b) => b.slug === filters.make)
  if (filters.make) chips.push({ key: 'make', label: brand?.name || filters.make, apply: drop('make', 'model') })
  if (filters.model) {
    const model = taxonomy?.models?.find((m) => m.slug === filters.model && (!brand || m.brandId === brand.id))
    chips.push({ key: 'model', label: model?.name || filters.model, apply: drop('model') })
  }
  if (filters.body) {
    const b = taxonomy?.bodyTypes?.find((x) => x.slug === filters.body)
    chips.push({ key: 'body', label: b?.name || filters.body, apply: drop('body') })
  }
  if (filters.minPrice || filters.maxPrice) {
    chips.push({ key: 'price', label: rangeLabel(+filters.minPrice, +filters.maxPrice, formatCompactKES), apply: drop('minPrice', 'maxPrice') })
  }
  if (filters.minYear || filters.maxYear) {
    chips.push({ key: 'year', label: rangeLabel(filters.minYear, filters.maxYear, String), apply: drop('minYear', 'maxYear') })
  }
  if (filters.location) {
    const l = taxonomy?.locations?.find((x) => x.slug === filters.location)
    chips.push({ key: 'location', label: filters.location === 'other' ? 'Other towns' : l?.name || filters.location, apply: drop('location') })
  }
  if (filters.condition) {
    chips.push({ key: 'condition', label: CONDITIONS.find((c) => c.slug === filters.condition)?.label || filters.condition, apply: drop('condition') })
  }
  if (filters.import) {
    chips.push({ key: 'import', label: IMPORT_STATUSES.find((c) => c.slug === filters.import)?.label || filters.import, apply: drop('import') })
  }
  if (filters.fuel) {
    chips.push({ key: 'fuel', label: taxonomy?.fuelTypes?.find((x) => x.slug === filters.fuel)?.name || filters.fuel, apply: drop('fuel') })
  }
  if (filters.transmission) {
    chips.push({ key: 'transmission', label: taxonomy?.transmissions?.find((x) => x.slug === filters.transmission)?.name || filters.transmission, apply: drop('transmission') })
  }
  if (filters.drive) chips.push({ key: 'drive', label: filters.drive.toUpperCase(), apply: drop('drive') })
  if (filters.minEngine || filters.maxEngine) {
    chips.push({ key: 'engine', label: rangeLabel(filters.minEngine, filters.maxEngine, (v) => formatNumber(+v), 'cc'), apply: drop('minEngine', 'maxEngine') })
  }
  if (filters.maxMileage) chips.push({ key: 'maxMileage', label: `Under ${formatNumber(+filters.maxMileage)} km`, apply: drop('maxMileage') })
  if (filters.sellerType) {
    chips.push({ key: 'sellerType', label: SELLER_TYPES.find((s) => s.slug === filters.sellerType)?.label || filters.sellerType, apply: drop('sellerType') })
  }
  if (filters.verified) chips.push({ key: 'verified', label: 'Verified sellers', apply: drop('verified') })
  if (filters.availability === 'all') chips.push({ key: 'availability', label: 'Including sold', apply: drop('availability') })
  if (filters.availability === 'sold') chips.push({ key: 'availability', label: 'Sold only', apply: drop('availability') })
  for (const feat of filters.features || []) {
    const label = taxonomy?.features?.find((x) => x.slug === feat)?.name || feat
    chips.push({
      key: `feature-${feat}`,
      label,
      apply: (f) => {
        const next = { ...f, features: (f.features || []).filter((x) => x !== feat) }
        delete next.page
        return next
      },
    })
  }
  if (filters.q) chips.push({ key: 'q', label: `“${filters.q}”`, apply: drop('q') })
  return chips
}

/** Human summary, e.g. "Toyota Prado SUVs under KES 5M in Nairobi" — used for headings & SEO. */
export function describeFilters(filters, taxonomy) {
  const brand = taxonomy?.brands?.find((b) => b.slug === filters.make)
  const model = taxonomy?.models?.find((m) => m.slug === filters.model && (!brand || m.brandId === brand.id))
  const body = taxonomy?.bodyTypes?.find((b) => b.slug === filters.body)
  const loc = taxonomy?.locations?.find((l) => l.slug === filters.location)
  const cond = CONDITIONS.find((c) => c.slug === filters.condition)
  const parts = []
  if (cond) parts.push(cond.label)
  if (brand) parts.push(brand.name)
  if (model) parts.push(model.name)
  parts.push(body ? body.plural || `${body.name}s` : 'cars')
  let s = parts.join(' ')
  if (filters.minPrice && filters.maxPrice) s += ` between ${formatCompactKES(+filters.minPrice)} and ${formatCompactKES(+filters.maxPrice)}`
  else if (filters.maxPrice) s += ` under ${formatCompactKES(+filters.maxPrice)}`
  else if (filters.minPrice) s += ` above ${formatCompactKES(+filters.minPrice)}`
  s += loc ? ` in ${loc.name}` : ' for sale in Kenya'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

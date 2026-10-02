import { CONDITIONS, IMPORT_STATUSES, LIMITS, PRICE_PRESETS } from '../../../lib/constants'
import { contactFormSchema } from '../../../lib/schemas'
import { now, paginate, uid } from '../db'
import { canManageVehicle, notFound, rateLimit, track, validate } from '../http'
import { lookups, scoreQuery, searchTokens, toCard, toDetail, toOwnerView, tokenize } from '../vehicleUtils'
import { COUNTIES } from '../seedData'

const isLive = (iso) => !!iso && new Date(iso).getTime() > Date.now()
const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

/** Builds the predicate list for a filter set. `skip` omits keys (used for facet counts). */
function buildPredicates(db, f, L, skip = new Set()) {
  const preds = []
  const has = (k) => !skip.has(k) && f[k] != null && f[k] !== ''

  const availability = f.availability || 'available'
  const statuses = availability === 'all' ? ['PUBLISHED', 'SOLD'] : availability === 'sold' ? ['SOLD'] : ['PUBLISHED']
  preds.push((v) => statuses.includes(v.status) && !v.deletedAt)

  if (has('make')) {
    const brand = db.brands.find((b) => b.slug === f.make)
    preds.push((v) => v.brandId === brand?.id)
    if (has('model')) {
      const model = db.models.find((m) => m.slug === f.model && m.brandId === brand?.id)
      preds.push((v) => v.modelId === model?.id)
    }
  }
  if (has('body')) {
    const b = db.bodyTypes.find((x) => x.slug === f.body)
    preds.push((v) => v.bodyTypeId === b?.id)
  }
  if (has('fuel')) {
    const x = db.fuelTypes.find((t) => t.slug === f.fuel)
    preds.push((v) => v.fuelTypeId === x?.id)
  }
  if (has('transmission')) {
    const x = db.transmissions.find((t) => t.slug === f.transmission)
    preds.push((v) => v.transmissionId === x?.id)
  }
  if (has('drive')) preds.push((v) => v.driveType.toLowerCase() === String(f.drive).toLowerCase())
  if (has('condition')) {
    const c = CONDITIONS.find((x) => x.slug === f.condition)?.value
    preds.push((v) => v.condition === c)
  }
  if (has('import')) {
    const c = IMPORT_STATUSES.find((x) => x.slug === f.import)?.value
    preds.push((v) => v.importStatus === c)
  }
  if (has('location')) {
    if (f.location === 'other') {
      const major = new Set(db.locations.filter((l) => l.major).map((l) => l.slug))
      preds.push((v) => !major.has(v.locationSlug))
    } else {
      const loc = db.locations.find((l) => l.slug === f.location)
      // A major town also matches its whole county (e.g. Nakuru includes Naivasha).
      preds.push((v) => v.locationSlug === f.location || (loc?.major && v.county === loc.county))
    }
  }
  if (!skip.has('price')) {
    const min = num(f.minPrice)
    const max = num(f.maxPrice)
    if (min != null) preds.push((v) => v.price >= min)
    if (max != null) preds.push((v) => v.price <= max)
  }
  const minY = num(f.minYear)
  const maxY = num(f.maxYear)
  if (minY != null) preds.push((v) => v.year >= minY)
  if (maxY != null) preds.push((v) => v.year <= maxY)
  const minE = num(f.minEngine)
  const maxE = num(f.maxEngine)
  if (minE != null) preds.push((v) => v.engineCc >= minE)
  if (maxE != null) preds.push((v) => v.engineCc <= maxE)
  const maxM = num(f.maxMileage)
  if (maxM != null) preds.push((v) => v.mileageKm <= maxM)
  if (has('sellerType')) {
    const map = { dealer: 'DEALER', private: 'PRIVATE', agent: 'AGENT' }
    preds.push((v) => v.sellerType === map[f.sellerType])
  }
  if (has('verified')) {
    preds.push((v) => (v.dealerId ? L.dealers.get(v.dealerId)?.verified : L.users.get(v.sellerId)?.verified))
  }
  if (has('dealer')) {
    const d = db.dealers.find((x) => x.slug === f.dealer)
    preds.push((v) => v.dealerId === d?.id)
  }
  const features = Array.isArray(f.features) ? f.features : f.features ? String(f.features).split(',') : []
  if (!skip.has('features') && features.length) preds.push((v) => features.every((x) => v.features.includes(x)))
  // Hide listings from suspended sellers/dealers.
  preds.push((v) => !L.users.get(v.sellerId)?.suspended && !(v.dealerId && L.dealers.get(v.dealerId)?.suspended))
  return preds
}

const SORTERS = {
  newest: (a, b) => Number(isLive(b.boostedUntil)) - Number(isLive(a.boostedUntil)) || (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  mileage_asc: (a, b) => a.mileageKm - b.mileageKm,
  year_desc: (a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt),
  popular: (a, b) => b.views - a.views,
}

export function searchVehicles(db, f, { withFacets = false } = {}) {
  const L = lookups(db)
  const preds = buildPredicates(db, f, L)
  let rows = db.vehicles.filter((v) => preds.every((p) => p(v)))

  const qTokens = f.q ? tokenize(String(f.q).slice(0, 100)) : []
  let scores = null
  if (qTokens.length) {
    const refMatch = String(f.q).trim().toUpperCase().replace(/^GN-?/, '')
    scores = new Map()
    rows = rows.filter((v) => {
      if (v.ref === refMatch) {
        scores.set(v.id, 1000)
        return true
      }
      const s = scoreQuery(qTokens, searchTokens(v, L))
      if (s) scores.set(v.id, s)
      return s > 0
    })
  }
  const sort = f.sort && SORTERS[f.sort] ? f.sort : null
  if (sort) rows.sort(SORTERS[sort])
  else if (scores) rows.sort((a, b) => scores.get(b.id) - scores.get(a.id) || SORTERS.newest(a, b))
  else rows.sort(SORTERS.newest)

  const page = paginate(rows, f.page, Math.min(Number(f.pageSize) || LIMITS.pageSize, 60))
  const result = { ...page, items: page.items.map((v) => toCard(v, L)) }

  if (withFacets) {
    const facet = (skipKeys, keyFn) => {
      const ps = buildPredicates(db, f, L, new Set(skipKeys))
      const counts = {}
      for (const v of db.vehicles) {
        if (!ps.every((p) => p(v))) continue
        if (qTokens.length && !scoreQuery(qTokens, searchTokens(v, L))) continue
        const k = keyFn(v)
        counts[k] = (counts[k] || 0) + 1
      }
      return counts
    }
    const bySlug = (map, field) => (v) => map.get(v[field])?.slug
    result.facets = {
      make: facet(['make', 'model'], bySlug(L.brands, 'brandId')),
      model: f.make ? facet(['model'], bySlug(L.models, 'modelId')) : {},
      body: facet(['body'], bySlug(L.bodyTypes, 'bodyTypeId')),
      fuel: facet(['fuel'], bySlug(L.fuelTypes, 'fuelTypeId')),
      transmission: facet(['transmission'], bySlug(L.transmissions, 'transmissionId')),
      condition: facet(['condition'], (v) => CONDITIONS.find((c) => c.value === v.condition)?.slug),
      location: facet(['location'], (v) => v.locationSlug),
    }
  }
  return result
}

function liveVehicles(db) {
  const L = lookups(db)
  return db.vehicles.filter((v) => v.status === 'PUBLISHED' && !v.deletedAt && !L.users.get(v.sellerId)?.suspended)
}

function countBy(rows, key) {
  const m = {}
  for (const r of rows) m[r[key]] = (m[r[key]] || 0) + 1
  return m
}

// Tracks one view per visitor per vehicle per day.
const viewed = new Set()

export default function register(r) {
  r.get('/api/taxonomy', async ({ db }) => {
    const live = liveVehicles(db)
    const byBrand = countBy(live, 'brandId')
    const byModel = countBy(live, 'modelId')
    const byBody = countBy(live, 'bodyTypeId')
    const strip = ({ createdAt, ...x }) => x // eslint-disable-line no-unused-vars
    return {
      brands: db.brands.filter((b) => b.active && !b.deletedAt).sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ ...strip(b), count: byBrand[b.id] || 0 })),
      models: db.models.filter((m) => m.active && !m.deletedAt).sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ ...strip(m), count: byModel[m.id] || 0 })),
      bodyTypes: db.bodyTypes.filter((b) => !b.deletedAt).sort((a, b) => a.sort - b.sort).map((b) => ({ ...b, count: byBody[b.id] || 0 })),
      fuelTypes: db.fuelTypes,
      transmissions: db.transmissions,
      locations: db.locations,
      features: db.features,
      counties: COUNTIES,
    }
  })

  r.get('/api/vehicles', async (ctx) => {
    const f = ctx.query
    const result = searchVehicles(ctx.db, f, { withFacets: f.facets === '1' })
    if (f.track === '1' && (f.q || f.make || f.body || f.maxPrice)) {
      track(ctx, 'SEARCH', { meta: { q: f.q || null, make: f.make || null, model: f.model || null, body: f.body || null, maxPrice: num(f.maxPrice) } })
    }
    return result
  })

  r.get('/api/search/suggest', async ({ db, query }) => {
    const q = String(query.q || '').trim().toLowerCase()
    if (q.length < 1) return { items: [] }
    const tokens = tokenize(q)
    const live = liveVehicles(db)
    const byModel = countBy(live, 'modelId')
    const byBrand = countBy(live, 'brandId')
    const items = []
    const ref = q.toUpperCase().replace(/^GN-?/, '')
    const refHit = db.vehicles.find((v) => v.ref === ref && v.status === 'PUBLISHED')
    if (refHit) items.push({ type: 'vehicle', label: `Listing ${refHit.ref}`, href: `/vehicle/${refHit.slug}` })
    for (const b of db.brands) {
      const s = scoreQuery(tokens, new Set(tokenize([b.name, ...(b.aliases || [])].join(' '))))
      if (s && byBrand[b.id]) items.push({ type: 'make', label: b.name, sub: `${byBrand[b.id]} cars`, href: `/cars/${b.slug}`, score: s + 1 })
    }
    for (const m of db.models) {
      const brand = db.brands.find((b) => b.id === m.brandId)
      const s = scoreQuery(tokens, new Set(tokenize(`${brand.name} ${(brand.aliases || []).join(' ')} ${m.name} ${m.name.replace(/\s+/g, '')}`)))
      if (s && byModel[m.id]) items.push({ type: 'model', label: `${brand.name} ${m.name}`, sub: `${byModel[m.id]} cars`, href: `/cars?make=${brand.slug}&model=${m.slug}`, score: s })
    }
    for (const b of db.bodyTypes) {
      const s = scoreQuery(tokens, new Set(tokenize(`${b.name} ${b.plural}`)))
      if (s) items.push({ type: 'body', label: b.plural, href: `/cars/body/${b.slug}`, score: s - 0.5 })
    }
    for (const d of db.dealers.filter((x) => !x.deletedAt && !x.suspended)) {
      const s = scoreQuery(tokens, new Set(tokenize(d.name)))
      if (s) items.push({ type: 'dealer', label: d.name, sub: d.town, href: `/dealer/${d.slug}`, score: s - 0.5 })
    }
    items.sort((a, b) => (b.score || 99) - (a.score || 99))
    return { items: items.slice(0, 8).map(({ score, ...x }) => x) } // eslint-disable-line no-unused-vars
  })

  r.get('/api/vehicles/:slug', async (ctx) => {
    const { db, params } = ctx
    const v = db.vehicles.find((x) => (x.slug === params.slug || x.id === params.slug) && !x.deletedAt)
    if (!v) throw notFound('This vehicle could not be found.')
    const L = lookups(db)
    const manage = canManageVehicle(db, ctx.user, v)
    const sellerSuspended = L.users.get(v.sellerId)?.suspended || (v.dealerId && L.dealers.get(v.dealerId)?.suspended)
    const isPublic = ['PUBLISHED', 'SOLD'].includes(v.status) && !sellerSuspended
    if (!isPublic && !manage) throw notFound('This listing is no longer available.')
    return { vehicle: manage ? toOwnerView(v, db, L) : toDetail(v, db, L), canManage: manage }
  })

  r.get('/api/vehicles/:id/related', async ({ db, params }) => {
    const v = db.vehicles.find((x) => x.id === params.id)
    if (!v) return { items: [] }
    const L = lookups(db)
    const pool = liveVehicles(db).filter((x) => x.id !== v.id)
    const score = (x) => (x.modelId === v.modelId ? 4 : 0) + (x.brandId === v.brandId ? 2 : 0) + (x.bodyTypeId === v.bodyTypeId ? 2 : 0) + (Math.abs(x.price - v.price) / v.price < 0.3 ? 2 : 0) + (x.dealerId && x.dealerId === v.dealerId ? 1 : 0)
    const items = pool.map((x) => [score(x), x]).filter(([s]) => s >= 3).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, x]) => toCard(x, L))
    return { items }
  })

  r.post('/api/vehicles/:id/view', async (ctx) => {
    const v = ctx.db.vehicles.find((x) => x.id === ctx.params.id && x.status === 'PUBLISHED')
    if (!v) return { ok: true }
    const key = `${ctx.visitorId || ctx.ip}:${v.id}:${new Date().toDateString()}`
    if (!viewed.has(key) && v.sellerId !== ctx.user?.id) {
      viewed.add(key)
      v.views += 1
      track(ctx, 'VEHICLE_VIEW', { vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId })
    }
    return { ok: true }
  })

  r.post('/api/events', async (ctx) => {
    rateLimit(ctx, 'events', 120, 60_000)
    const allowed = ['PHONE_CLICK', 'WHATSAPP_CLICK', 'EMAIL_CLICK', 'SHARE']
    const { type, vehicleId, meta } = ctx.body || {}
    if (!allowed.includes(type)) return { ok: false }
    const v = ctx.db.vehicles.find((x) => x.id === vehicleId)
    track(ctx, type, { vehicleId: v?.id || null, dealerId: v?.dealerId || null, sellerId: v?.sellerId || null, meta: meta || null })
    return { ok: true }
  })

  r.get('/api/home', async ({ db }) => {
    const L = lookups(db)
    const live = liveVehicles(db)
    const promoted = db.promotions.filter((p) => p.active && p.placement === 'HOMEPAGE_FEATURED' && isLive(p.endsAt) && new Date(p.startsAt) <= new Date()).map((p) => p.vehicleId)
    const featured = [
      ...live.filter((v) => promoted.includes(v.id)),
      ...live.filter((v) => isLive(v.featuredUntil) && !promoted.includes(v.id)).sort((a, b) => b.views - a.views),
    ].slice(0, 8)
    const latest = [...live].sort(SORTERS.newest).slice(0, 12)
    const byBrand = countBy(live, 'brandId')
    const byBody = countBy(live, 'bodyTypeId')
    return {
      settings: db.settings.homepage,
      totalListings: live.length,
      dealerCount: db.dealers.filter((d) => !d.deletedAt && !d.suspended).length,
      featured: featured.map((v) => toCard(v, L)),
      latest: latest.map((v) => toCard(v, L)),
      brands: db.brands.filter((b) => b.active && byBrand[b.id]).map((b) => ({ id: b.id, name: b.name, slug: b.slug, popular: b.popular, count: byBrand[b.id] })).sort((a, b) => b.count - a.count),
      bodyTypes: db.bodyTypes.map((b) => ({ id: b.id, name: b.name, plural: b.plural, slug: b.slug, count: byBody[b.id] || 0 })).filter((b) => b.count),
      priceBands: PRICE_PRESETS.map((p) => ({ ...p, count: live.filter((v) => (p.min == null || v.price >= p.min) && (p.max == null || v.price <= p.max)).length })),
      dealers: db.dealers.filter((d) => !d.deletedAt && !d.suspended).map((d) => ({ id: d.id, slug: d.slug, name: d.name, logoUrl: d.logoUrl, verified: d.verified, town: d.town, count: live.filter((v) => v.dealerId === d.id).length })).sort((a, b) => Number(b.verified) - Number(a.verified) || b.count - a.count).slice(0, 8),
    }
  })

  // Data for SEO landing pages: real statistics so pages are not thin duplicates.
  r.get('/api/landing', async ({ db, query }) => {
    const f = { ...query, page: 1, pageSize: 1000 }
    const L = lookups(db)
    const preds = buildPredicates(db, f, L)
    const rows = db.vehicles.filter((v) => preds.every((p) => p(v)))
    const prices = rows.map((v) => v.price).sort((a, b) => a - b)
    const years = rows.map((v) => v.year)
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : null
    const topModels = Object.entries(countBy(rows, 'modelId')).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, count]) => {
      const m = L.models.get(id)
      const b = L.brands.get(m.brandId)
      const ps = rows.filter((v) => v.modelId === id).map((v) => v.price)
      return { name: `${b.name} ${m.name}`, href: `/cars?make=${b.slug}&model=${m.slug}`, count, minPrice: Math.min(...ps), maxPrice: Math.max(...ps) }
    })
    const bodySplit = Object.entries(countBy(rows, 'bodyTypeId')).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ name: L.bodyTypes.get(id)?.plural, slug: L.bodyTypes.get(id)?.slug, count }))
    const fuelSplit = Object.entries(countBy(rows, 'fuelTypeId')).map(([id, count]) => ({ name: L.fuelTypes.get(id)?.name, count }))
    const dealerShare = rows.length ? Math.round((rows.filter((v) => v.dealerId).length / rows.length) * 100) : 0
    const seo = db.seoRecords.find((s) => s.path === query.path) || null
    return {
      stats: { count: rows.length, minPrice: prices[0] ?? null, maxPrice: prices.at(-1) ?? null, medianPrice: median, minYear: years.length ? Math.min(...years) : null, maxYear: years.length ? Math.max(...years) : null, topModels, bodySplit, fuelSplit, dealerShare },
      seo,
    }
  })

  r.get('/api/dealers', async ({ db, query }) => {
    const live = liveVehicles(db)
    let rows = db.dealers.filter((d) => !d.deletedAt && !d.suspended)
    if (query.q) {
      const t = tokenize(query.q)
      rows = rows.filter((d) => scoreQuery(t, new Set(tokenize(`${d.name} ${d.town} ${d.county}`))))
    }
    if (query.location) rows = rows.filter((d) => d.locationSlug === query.location)
    if (query.verified === '1') rows = rows.filter((d) => d.verified)
    const items = rows.map((d) => ({
      id: d.id, slug: d.slug, name: d.name, tagline: d.tagline, logoUrl: d.logoUrl, verified: d.verified, town: d.town, county: d.county,
      since: d.since, count: live.filter((v) => v.dealerId === d.id).length,
    })).sort((a, b) => Number(b.verified) - Number(a.verified) || b.count - a.count)
    return paginate(items, query.page, 24)
  })

  r.get('/api/dealers/:slug', async ({ db, params }) => {
    const d = db.dealers.find((x) => x.slug === params.slug && !x.deletedAt)
    if (!d || d.suspended) throw notFound('This dealer could not be found.')
    const own = db.vehicles.filter((v) => v.dealerId === d.id && !v.deletedAt)
    const live = own.filter((v) => v.status === 'PUBLISHED')
    const L = lookups(db)
    const brandCounts = Object.entries(countBy(live, 'brandId')).map(([id, count]) => ({ slug: L.brands.get(id).slug, name: L.brands.get(id).name, count })).sort((a, b) => b.count - a.count)
    return {
      dealer: {
        id: d.id, slug: d.slug, name: d.name, tagline: d.tagline, description: d.description, logoUrl: d.logoUrl, coverUrl: d.coverUrl, brandColour: d.brandColour,
        verified: d.verified, verifiedAt: d.verifiedAt, phone: d.phone, whatsapp: d.whatsapp, email: d.email, website: d.website,
        county: d.county, town: d.town, address: d.address, openingHours: d.openingHours, since: d.since, createdAt: d.createdAt,
      },
      stats: {
        activeListings: live.length,
        soldListings: own.filter((v) => v.status === 'SOLD').length,
        minPrice: live.length ? Math.min(...live.map((v) => v.price)) : null,
        maxPrice: live.length ? Math.max(...live.map((v) => v.price)) : null,
        brands: brandCounts,
      },
    }
  })

  r.get('/api/pages/:slug', async ({ db, params }) => {
    const p = db.cmsPages.find((x) => x.slug === params.slug && x.published && !x.deletedAt)
    if (!p) throw notFound('Page not found.')
    return { page: p }
  })

  r.get('/api/seo', async ({ db, query }) => ({ record: db.seoRecords.find((s) => s.path === query.path && !s.deletedAt) || null }))

  r.get('/api/packages', async ({ db }) => ({ items: db.packages.filter((p) => p.active && !p.deletedAt).sort((a, b) => a.sort - b.sort) }))

  r.get('/api/sitemap', async ({ db }) => {
    const live = liveVehicles(db)
    return {
      vehicles: live.map((v) => ({ path: `/vehicle/${v.slug}`, updatedAt: v.updatedAt })),
      dealers: db.dealers.filter((d) => !d.deletedAt && !d.suspended).map((d) => ({ path: `/dealer/${d.slug}`, updatedAt: d.createdAt })),
      brands: db.brands.filter((b) => b.active).map((b) => ({ path: `/cars/${b.slug}` })),
      bodyTypes: db.bodyTypes.map((b) => ({ path: `/cars/body/${b.slug}` })),
    }
  })

  r.post('/api/contact', async (ctx) => {
    rateLimit(ctx, 'contact', 3, 10 * 60_000)
    const data = validate(contactFormSchema, ctx.body)
    ctx.db.contactMessages.unshift({ id: uid(), ...data, userId: ctx.user?.id || null, status: 'OPEN', createdAt: now() })
    return { status: 201, data: { ok: true } }
  })
}

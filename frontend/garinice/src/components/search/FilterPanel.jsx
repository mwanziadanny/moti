import { ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import {
  CONDITIONS, DRIVE_TYPES, ENGINE_PRESETS, FEATURE_GROUP_LABELS, IMPORT_STATUSES, MILEAGE_PRESETS, PRICE_PRESETS, SELLER_TYPES, YEAR_PRESETS,
} from '../../lib/constants'
import { filterChips } from '../../lib/filters'
import { cn, formatNumber } from '../../lib/format'
import { Button } from '../ui/Button'
import { Checkbox, ChipToggle, PriceInput, Select } from '../ui/Form'

function Group({ title, children, defaultOpen = true, count }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line py-4 last:border-0">
      <h3>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-left text-sm font-semibold text-ink">
          <span>{title}{count ? <span className="ml-1.5 rounded-full bg-teal-600 px-1.5 text-[11px] text-white">{count}</span> : null}</span>
          <ChevronDown className={cn('size-4 text-slate-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </h3>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

const withCount = (label, n) => (n != null ? `${label} (${formatNumber(n)})` : label)

function PriceGroup({ filters, onChange }) {
  const [min, setMin] = useState(filters.minPrice || '')
  const [max, setMax] = useState(filters.maxPrice || '')
  const [synced, setSynced] = useState(`${filters.minPrice}|${filters.maxPrice}`)
  if (synced !== `${filters.minPrice}|${filters.maxPrice}`) {
    setSynced(`${filters.minPrice}|${filters.maxPrice}`)
    setMin(filters.minPrice || '')
    setMax(filters.maxPrice || '')
  }
  const presetActive = (p) => String(p.min ?? '') === String(filters.minPrice ?? '') && String(p.max ?? '') === String(filters.maxPrice ?? '')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRICE_PRESETS.filter((p) => p.slug !== 'under-500k').map((p) => (
          <ChipToggle key={p.slug} label={p.label.replace('KES ', '')} selected={presetActive(p)} onToggle={() => onChange(presetActive(p) ? { minPrice: undefined, maxPrice: undefined } : { minPrice: p.min, maxPrice: p.max })} />
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          let a = min ? Number(min) : undefined
          let b = max ? Number(max) : undefined
          if (a && b && a > b) [a, b] = [b, a]
          onChange({ minPrice: a, maxPrice: b })
        }}
      >
        <PriceInput size="sm" aria-label="Minimum price" placeholder="Min" prefix="" value={min} onChange={setMin} className="h-9 pl-3 text-sm" />
        <span className="pb-2 text-muted">–</span>
        <PriceInput size="sm" aria-label="Maximum price" placeholder="Max" prefix="" value={max} onChange={setMax} className="h-9 pl-3 text-sm" />
        <Button type="submit" size="sm" variant="secondary">Go</Button>
      </form>
    </div>
  )
}

/**
 * Inventory filters. Every control maps to a URL query param via `onChange(patch)`.
 * `facets` provides live counts so users never pick a dead-end option.
 */
export function FilterPanel({ filters, onChange, facets = {}, taxonomy, locked = {}, className }) {
  const brands = taxonomy?.brands || []
  const brand = brands.find((b) => b.slug === filters.make)
  const models = brand ? (taxonomy?.models || []).filter((m) => m.brandId === brand.id) : []
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear + 1 - i)
  const features = taxonomy?.features || []
  const [showAllFeatures, setShowAllFeatures] = useState(false)
  const selectedFeatures = filters.features || []
  const featureGroups = Object.keys(FEATURE_GROUP_LABELS)
  const set = (patch) => onChange(patch)

  return (
    <div className={cn('text-sm', className)}>
      {!locked.make && (
        <Group title="Make & model">
          <div className="space-y-2">
            <Select aria-label="Make" size="sm" value={filters.make || ''} onChange={(e) => set({ make: e.target.value || undefined, model: undefined })}>
              <option value="">All makes</option>
              {brands.map((b) => <option key={b.slug} value={b.slug} disabled={!facets.make?.[b.slug] && filters.make !== b.slug}>{withCount(b.name, facets.make?.[b.slug] || 0)}</option>)}
            </Select>
            <Select aria-label="Model" size="sm" value={filters.model || ''} disabled={!brand} onChange={(e) => set({ model: e.target.value || undefined })}>
              <option value="">{brand ? `All ${brand.name} models` : 'Select a make first'}</option>
              {models.map((m) => <option key={m.slug} value={m.slug} disabled={!facets.model?.[m.slug] && filters.model !== m.slug}>{withCount(m.name, facets.model?.[m.slug] || 0)}</option>)}
            </Select>
          </div>
        </Group>
      )}
      {locked.make && models.length > 0 && (
        <Group title="Model">
          <Select aria-label="Model" size="sm" value={filters.model || ''} onChange={(e) => set({ model: e.target.value || undefined })}>
            <option value="">All {brand?.name} models</option>
            {models.map((m) => <option key={m.slug} value={m.slug}>{withCount(m.name, facets.model?.[m.slug] || 0)}</option>)}
          </Select>
        </Group>
      )}
      {!locked.price && (
        <Group title="Price (KES)" count={filters.minPrice || filters.maxPrice ? 1 : 0}>
          <PriceGroup filters={filters} onChange={set} />
        </Group>
      )}
      <Group title="Year">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {YEAR_PRESETS.slice(0, 3).map((y) => {
              const active = String(y.min ?? '') === String(filters.minYear ?? '') && String(y.max ?? '') === String(filters.maxYear ?? '')
              return <ChipToggle key={y.slug} label={y.label} selected={active} onToggle={() => set(active ? { minYear: undefined, maxYear: undefined } : { minYear: y.min, maxYear: y.max })} />
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Year from" size="sm" value={filters.minYear || ''} onChange={(e) => set({ minYear: e.target.value || undefined })}>
              <option value="">From</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select aria-label="Year to" size="sm" value={filters.maxYear || ''} onChange={(e) => set({ maxYear: e.target.value || undefined })}>
              <option value="">To</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </div>
      </Group>
      {!locked.body && (
        <Group title="Body type" count={filters.body ? 1 : 0}>
          <div className="flex flex-wrap gap-1.5">
            {(taxonomy?.bodyTypes || []).map((b) => (
              <ChipToggle key={b.slug} label={b.name} count={facets.body?.[b.slug] || 0} selected={filters.body === b.slug} onToggle={() => set({ body: filters.body === b.slug ? undefined : b.slug })} />
            ))}
          </div>
        </Group>
      )}
      <Group title="Location">
        <Select aria-label="Location" size="sm" value={filters.location || ''} onChange={(e) => set({ location: e.target.value || undefined })}>
          <option value="">All Kenya</option>
          {(taxonomy?.locations || []).map((l) => <option key={l.slug} value={l.slug}>{withCount(l.name, facets.location?.[l.slug])}</option>)}
          <option value="other">Other towns</option>
        </Select>
      </Group>
      <Group title="Condition">
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => <ChipToggle key={c.slug} label={c.label} count={facets.condition?.[c.slug] || 0} selected={filters.condition === c.slug} onToggle={() => set({ condition: filters.condition === c.slug ? undefined : c.slug })} />)}
        </div>
      </Group>
      <Group title="Import status" defaultOpen={false} count={filters.import ? 1 : 0}>
        <div className="flex flex-wrap gap-1.5">
          {IMPORT_STATUSES.map((c) => <ChipToggle key={c.slug} label={c.label} selected={filters.import === c.slug} onToggle={() => set({ import: filters.import === c.slug ? undefined : c.slug })} />)}
        </div>
      </Group>
      <Group title="Fuel & transmission">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(taxonomy?.fuelTypes || []).map((f) => <ChipToggle key={f.slug} label={f.name} count={facets.fuel?.[f.slug] || 0} selected={filters.fuel === f.slug} onToggle={() => set({ fuel: filters.fuel === f.slug ? undefined : f.slug })} />)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(taxonomy?.transmissions || []).map((t) => <ChipToggle key={t.slug} label={t.name} count={facets.transmission?.[t.slug] || 0} selected={filters.transmission === t.slug} onToggle={() => set({ transmission: filters.transmission === t.slug ? undefined : t.slug })} />)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DRIVE_TYPES.map((d) => <ChipToggle key={d.value} label={d.label} selected={filters.drive === d.value.toLowerCase()} onToggle={() => set({ drive: filters.drive === d.value.toLowerCase() ? undefined : d.value.toLowerCase() })} />)}
          </div>
        </div>
      </Group>
      <Group title="Engine & mileage" defaultOpen={false} count={(filters.minEngine || filters.maxEngine ? 1 : 0) + (filters.maxMileage ? 1 : 0)}>
        <div className="space-y-2">
          <Select aria-label="Engine capacity" size="sm" value={ENGINE_PRESETS.find((p) => String(p.min ?? '') === String(filters.minEngine ?? '') && String(p.max ?? '') === String(filters.maxEngine ?? ''))?.slug || ''} onChange={(e) => {
            const p = ENGINE_PRESETS.find((x) => x.slug === e.target.value)
            set({ minEngine: p?.min, maxEngine: p?.max })
          }}>
            <option value="">Any engine size</option>
            {ENGINE_PRESETS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
          </Select>
          <Select aria-label="Maximum mileage" size="sm" value={filters.maxMileage || ''} onChange={(e) => set({ maxMileage: e.target.value || undefined })}>
            <option value="">Any mileage</option>
            {MILEAGE_PRESETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </div>
      </Group>
      <Group title="Seller" defaultOpen={false} count={(filters.sellerType ? 1 : 0) + (filters.verified ? 1 : 0)}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {SELLER_TYPES.map((s) => <ChipToggle key={s.slug} label={s.slug === 'agent' ? 'Agent' : s.label} selected={filters.sellerType === s.slug} onToggle={() => set({ sellerType: filters.sellerType === s.slug ? undefined : s.slug })} />)}
          </div>
          <Checkbox label="Verified sellers only" checked={!!filters.verified} onChange={(e) => set({ verified: e.target.checked ? '1' : undefined })} />
        </div>
      </Group>
      <Group title="Features" defaultOpen={selectedFeatures.length > 0} count={selectedFeatures.length}>
        <div className="space-y-4">
          {featureGroups.slice(0, showAllFeatures ? 4 : 1).map((g) => (
            <fieldset key={g}>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{FEATURE_GROUP_LABELS[g]}</legend>
              <div className="grid grid-cols-1 gap-2">
                {features.filter((f) => f.group === g).map((f) => (
                  <Checkbox key={f.slug} label={f.name} checked={selectedFeatures.includes(f.slug)} onChange={() => set({ features: selectedFeatures.includes(f.slug) ? selectedFeatures.filter((x) => x !== f.slug) : [...selectedFeatures, f.slug] })} />
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={() => setShowAllFeatures((s) => !s)} className="text-sm font-medium text-teal-700 hover:underline">{showAllFeatures ? 'Show fewer' : 'Show all features'}</button>
        </div>
      </Group>
      <Group title="Availability" defaultOpen={false}>
        <Select aria-label="Availability" size="sm" value={filters.availability || ''} onChange={(e) => set({ availability: e.target.value || undefined })}>
          <option value="">Available only</option>
          <option value="all">Include sold cars</option>
          <option value="sold">Sold cars only</option>
        </Select>
      </Group>
    </div>
  )
}

export function FilterChips({ filters, taxonomy, onApply, onClear, locked = {} }) {
  const chips = filterChips(filters, taxonomy).filter((c) => !locked[c.key])
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={() => onApply(c.apply(filters))} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-2 pl-3 text-sm font-medium text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100" aria-label={`Remove filter ${c.label}`}>
          {c.label}
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ))}
      {chips.length > 1 && <button type="button" onClick={onClear} className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline">Clear all</button>}
    </div>
  )
}

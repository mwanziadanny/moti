import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTaxonomy } from '../../hooks/queries'
import { CONDITIONS, HERO_PRICE_PRESETS, PRICE_PRESETS, YEAR_PRESETS } from '../../lib/constants'
import { carsUrl } from '../../lib/filters'
import { Button } from '../ui/Button'
import { PriceInput, Select } from '../ui/Form'
import { SearchAutocomplete } from './SearchAutocomplete'

function Labeled({ label, id, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</label>
      {children}
    </div>
  )
}

const MAJOR = ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret']

export function HeroSearch() {
  const navigate = useNavigate()
  const { data: tax } = useTaxonomy()
  const [q, setQ] = useState('')
  const [state, setState] = useState({ location: '', source: '', budget: '', minPrice: '', maxPrice: '', year: '', minYear: '', maxYear: '', body: '' })
  const set = (k) => (e) => setState((s) => ({ ...s, [k]: e?.target ? e.target.value : e }))
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear + 1 - i)

  const buildFilters = (term) => {
    const f = { q: term || undefined, location: state.location || undefined, body: state.body || undefined }
    if (state.source === 'direct-import') f.import = 'direct-import'
    else if (state.source) f.condition = state.source
    if (state.budget === 'custom') {
      f.minPrice = state.minPrice || undefined
      f.maxPrice = state.maxPrice || undefined
    } else if (state.budget) {
      const p = PRICE_PRESETS.find((x) => x.slug === state.budget)
      f.minPrice = p.min
      f.maxPrice = p.max
    }
    if (state.year === 'custom') {
      f.minYear = state.minYear || undefined
      f.maxYear = state.maxYear || undefined
    } else if (state.year) {
      const y = YEAR_PRESETS.find((x) => x.slug === state.year)
      f.minYear = y.min
      f.maxYear = y.max
    }
    return f
  }
  const go = (term = q) => navigate(carsUrl(buildFilters(term.trim())))

  return (
    <div className="rounded-2xl bg-white p-4 shadow-pop ring-1 ring-black/5 sm:p-5">
      <SearchAutocomplete size="lg" value={q} onValueChange={setQ} onSearch={go} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
        className="mt-4"
        aria-label="Filter search"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
          <Labeled label="Location" id="hero-location">
            <Select id="hero-location" value={state.location} onChange={set('location')}>
              <option value="">All Kenya</option>
              {(tax?.locations || []).filter((l) => MAJOR.includes(l.slug)).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
              <option value="other">Other towns</option>
            </Select>
          </Labeled>
          <Labeled label="Condition" id="hero-source">
            <Select id="hero-source" value={state.source} onChange={set('source')}>
              <option value="">All</option>
              {CONDITIONS.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              <option value="direct-import">Direct Import</option>
            </Select>
          </Labeled>
          <Labeled label="Budget" id="hero-budget">
            <Select id="hero-budget" value={state.budget} onChange={set('budget')}>
              <option value="">Any price</option>
              {HERO_PRICE_PRESETS.map((s) => <option key={s} value={s}>{PRICE_PRESETS.find((p) => p.slug === s).label}</option>)}
              <option value="custom">Custom range…</option>
            </Select>
          </Labeled>
          <Labeled label="Year" id="hero-year">
            <Select id="hero-year" value={state.year} onChange={set('year')}>
              <option value="">Any year</option>
              {YEAR_PRESETS.map((y) => <option key={y.slug} value={y.slug}>{y.label}</option>)}
              <option value="custom">Custom range…</option>
            </Select>
          </Labeled>
          <Labeled label="Vehicle type" id="hero-body">
            <Select id="hero-body" value={state.body} onChange={set('body')}>
              <option value="">All types</option>
              {(tax?.bodyTypes || []).map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </Select>
          </Labeled>
          <div className="col-span-2 lg:col-span-1">
            <Button type="submit" variant="accent" size="lg" block icon={Search} className="tracking-wide uppercase lg:px-7">Search cars</Button>
          </div>
        </div>
        {(state.budget === 'custom' || state.year === 'custom') && (
          <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            {state.budget === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <PriceInput aria-label="Minimum price" placeholder="Min price" value={state.minPrice} onChange={set('minPrice')} />
                <PriceInput aria-label="Maximum price" placeholder="Max price" value={state.maxPrice} onChange={set('maxPrice')} />
              </div>
            )}
            {state.year === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <Select aria-label="Year from" value={state.minYear} onChange={set('minYear')} placeholder="From year">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
                <Select aria-label="Year to" value={state.maxYear} onChange={set('maxYear')} placeholder="To year">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  )
}

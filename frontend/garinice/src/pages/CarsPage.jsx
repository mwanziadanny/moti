import { useQuery } from '@tanstack/react-query'
import { ArrowUpDown, LayoutGrid, List, PanelLeftClose, PanelLeftOpen, SearchX, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { FilterChips, FilterPanel } from '../components/search/FilterPanel'
import { SearchAutocomplete } from '../components/search/SearchAutocomplete'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Select } from '../components/ui/Form'
import { Breadcrumbs, Pagination } from '../components/ui/Navigation'
import { Drawer } from '../components/ui/Overlay'
import { VehicleCard, VehicleCardSkeleton } from '../components/vehicle/VehicleCard'
import { useTaxonomy, useVehicleSearch } from '../hooks/queries'
import { Seo } from '../hooks/useSeo'
import { useFilters } from '../hooks/useUtils'
import { PRICE_PRESETS, SITE, SORT_OPTIONS } from '../lib/constants'
import { countActiveFilters, describeFilters, toSearchParams } from '../lib/filters'
import { cn, formatCompactKES, formatNumber } from '../lib/format'
import NotFoundPage from './NotFoundPage'

/** Resolves the landing-page context (/cars/:make, /cars/body/:body, /cars/price/:range). */
function useLanding(kind) {
  const params = useParams()
  const { data: tax, isLoading } = useTaxonomy()
  return useMemo(() => {
    if (!kind) return { base: {}, locked: {}, ok: true }
    if (kind === 'make') {
      const brand = tax?.brands.find((b) => b.slug === params.make)
      if (!brand) return { ok: isLoading ? null : false }
      const model = params.model ? tax.models.find((m) => m.slug === params.model && m.brandId === brand.id) : null
      if (params.model && !model) return { ok: false }
      return { ok: true, kind, base: { make: brand.slug, ...(model ? { model: model.slug } : {}) }, locked: { make: true, ...(model ? { model: true } : {}) }, brand, model, path: `/cars/${brand.slug}${model ? `/${model.slug}` : ''}` }
    }
    if (kind === 'body') {
      const body = tax?.bodyTypes.find((b) => b.slug === params.body)
      if (!body) return { ok: isLoading ? null : false }
      return { ok: true, kind, base: { body: body.slug }, locked: { body: true }, body, path: `/cars/body/${body.slug}` }
    }
    if (kind === 'price') {
      const p = PRICE_PRESETS.find((x) => x.slug === params.range)
      if (!p) return { ok: false }
      return { ok: true, kind, base: { ...(p.min ? { minPrice: String(p.min) } : {}), ...(p.max ? { maxPrice: String(p.max) } : {}) }, locked: { price: true }, price: p, path: `/cars/price/${p.slug}` }
    }
    return { ok: false }
  }, [kind, params.make, params.model, params.body, params.range, tax, isLoading])
}

function LandingIntro({ landing, stats, seo }) {
  if (!landing.kind) return null
  const name = landing.brand ? `${landing.brand.name}${landing.model ? ` ${landing.model.name}` : ''}` : landing.body ? landing.body.plural : `Cars ${landing.price.label.replace('KES ', '').toLowerCase()}`
  const intro = seo?.intro || landing.body?.description
  return (
    <div className="max-w-3xl text-[15px] text-slate-600">
      {intro && <p>{intro}</p>}
      {stats && stats.count > 0 && (
        <p className={cn(intro && 'mt-2')}>
          There are <strong className="text-ink">{formatNumber(stats.count)}</strong> {name} listings on {SITE.name} right now, priced from{' '}
          <strong className="text-ink">{formatCompactKES(stats.minPrice)}</strong> to <strong className="text-ink">{formatCompactKES(stats.maxPrice)}</strong>
          {stats.medianPrice ? <> with a typical asking price of <strong className="text-ink">{formatCompactKES(stats.medianPrice)}</strong></> : null}.
        </p>
      )}
    </div>
  )
}

function LandingInsights({ landing, stats }) {
  if (!landing.kind || !stats?.count) return null
  const name = landing.brand ? landing.brand.name + (landing.model ? ` ${landing.model.name}` : '') : landing.body ? landing.body.plural : 'cars in this budget'
  return (
    <section className="mt-14 grid gap-6 rounded-2xl border border-line bg-white p-6 sm:p-8 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <h2 className="text-xl font-bold">{name} market snapshot</h2>
        <p className="mt-2 text-sm text-muted">Live figures from current listings on {SITE.name}. Prices are sellers’ asking prices, not valuations.</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted">Listings</dt><dd className="text-lg font-bold">{formatNumber(stats.count)}</dd></div>
          <div><dt className="text-muted">Median price</dt><dd className="text-lg font-bold">{formatCompactKES(stats.medianPrice)}</dd></div>
          <div><dt className="text-muted">Year range</dt><dd className="text-lg font-bold">{stats.minYear}–{stats.maxYear}</dd></div>
          <div><dt className="text-muted">From dealers</dt><dd className="text-lg font-bold">{stats.dealerShare}%</dd></div>
        </dl>
      </div>
      {stats.topModels?.length > 0 && (
        <div>
          <h3 className="font-semibold">Most listed models</h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {stats.topModels.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-3 py-2">
                <Link to={m.href} className="font-medium text-teal-700 hover:underline">{m.name}</Link>
                <span className="text-muted">{m.count} · {formatCompactKES(m.minPrice)}–{formatCompactKES(m.maxPrice)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="font-semibold">{landing.kind === 'body' ? 'Fuel types' : 'Body types'}</h3>
        <ul className="mt-3 divide-y divide-line text-sm">
          {(landing.kind === 'body' ? stats.fuelSplit : stats.bodySplit).map((b) => (
            <li key={b.name} className="flex justify-between py-2">
              {b.slug ? <Link to={`/cars/body/${b.slug}`} className="font-medium text-teal-700 hover:underline">{b.name}</Link> : <span>{b.name}</span>}
              <span className="text-muted">{b.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function CarsPage({ landingKind }) {
  const landing = useLanding(landingKind)
  const { filters, setFilters, update } = useFilters(landing.base || {})
  const { data: tax } = useTaxonomy()
  const query = useMemo(() => ({ ...filters, pageSize: 24 }), [filters])
  const { data, isPending: isLoading, isFetching, error, refetch } = useVehicleSearch(query, { track: true, enabled: landing.ok === true })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const [sidebar, setSidebar] = useState(true)
  const [layout, setLayout] = useState('grid')
  const resultsRef = useRef(null)
  const draftResults = useVehicleSearch({ ...draft, pageSize: 1 }, { facets: true, enabled: mobileOpen })
  const landingQuery = useQuery({
    queryKey: ['landing', landing.path, landing.base],
    queryFn: () => api.catalog.landing({ ...landing.base, path: landing.path }),
    enabled: !!landing.kind && landing.ok === true,
    staleTime: 5 * 60_000,
  })

  const page = Number(filters.page) || 1
  useEffect(() => {
    if (page > 1) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [page])

  if (landing.ok === false) return <NotFoundPage />

  const heading = landing.kind
    ? landing.brand ? `${landing.brand.name}${landing.model ? ` ${landing.model.name}` : ''} cars for sale in Kenya`
      : landing.body ? `${landing.body.plural} for sale in Kenya`
      : `Cars ${landing.price.label.replace('KES ', 'KES ').replace('Under', 'under').replace('Above', 'above')} in Kenya`
    : landing.ok === null ? 'Cars for sale in Kenya' : filters.q ? `Results for “${filters.q}”` : describeFilters(filters, tax)
  const total = data?.total ?? 0
  const seo = landingQuery.data?.seo
  const activeCount = countActiveFilters(filters) - Object.keys(landing.locked || {}).length
  const clearAll = () => setFilters({ ...landing.base, sort: filters.sort, q: undefined })
  const openMobile = () => {
    setDraft(filters)
    setMobileOpen(true)
  }
  const canonicalQs = toSearchParams({ make: filters.make, model: filters.model, body: filters.body, page: filters.page }, landing.base || {}).toString()
  const canonical = `${landing.path || '/cars'}${canonicalQs ? `?${canonicalQs}` : ''}`
  const breadcrumbs = [{ label: 'Cars', to: '/cars' }]
  if (landing.brand) breadcrumbs.push({ label: landing.brand.name, to: `/cars/${landing.brand.slug}` })
  if (landing.model) breadcrumbs.push({ label: landing.model.name })
  if (landing.body) breadcrumbs.push({ label: landing.body.plural })
  if (landing.price) breadcrumbs.push({ label: landing.price.label })

  const jsonLd = data?.items?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: heading,
        numberOfItems: total,
        itemListElement: data.items.slice(0, 24).map((v, i) => ({ '@type': 'ListItem', position: (page - 1) * 24 + i + 1, url: `${SITE.url}/vehicle/${v.slug}`, name: v.title })),
      }
    : null

  return (
    <>
      <Seo
        title={seo?.title || `${heading}${page > 1 ? ` – Page ${page}` : ''}`}
        description={seo?.description || `Browse ${formatNumber(total)} ${heading.toLowerCase()}. Compare prices, mileage and specs from dealers and private sellers on ${SITE.name}.`}
        canonical={canonical}
        noindex={!landing.kind && (countActiveFilters(filters) > 2 || !!filters.q)}
        jsonLd={jsonLd}
      />
      <div className="border-b border-line bg-white">
        <div className="container-page py-6 sm:py-8">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{heading}</h1>
          <LandingIntro landing={landing} stats={landingQuery.data?.stats} seo={seo} />
          <div className="mt-5 max-w-2xl lg:hidden">
            <SearchAutocomplete key={filters.q || ''} defaultValue={filters.q || ''} size="md" onSearch={(q) => update({ q: q || undefined })} />
          </div>
        </div>
      </div>

      <div className="container-page py-6 sm:py-8">
        <div className="flex gap-8">
          {sidebar && (
            <aside className="hidden w-72 shrink-0 md:block" aria-label="Filters">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl border border-line bg-white px-5 py-2 scrollbar-none">
                <div className="flex items-center justify-between border-b border-line py-3">
                  <h2 className="font-semibold">Filters</h2>
                  {activeCount > 0 && <button type="button" onClick={clearAll} className="text-sm font-medium text-teal-700 hover:underline">Clear all</button>}
                </div>
                <FilterPanel filters={filters} onChange={update} facets={data?.facets} taxonomy={tax} locked={landing.locked} />
              </div>
            </aside>
          )}

          <section className="min-w-0 flex-1" aria-labelledby="results-heading" ref={resultsRef}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 id="results-heading" className="mr-auto text-[15px] text-muted" aria-live="polite">
                {isLoading ? <Skeleton className="h-5 w-32" /> : <><strong className="font-display text-lg text-ink">{formatNumber(total)}</strong> {total === 1 ? 'car' : 'cars'} listed</>}
              </h2>
              <Button variant="secondary" size="sm" className="md:hidden" icon={SlidersHorizontal} onClick={openMobile}>
                Filter{activeCount > 0 && <span className="rounded-full bg-teal-600 px-1.5 text-xs text-white">{activeCount}</span>}
              </Button>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" icon={sidebar ? PanelLeftClose : PanelLeftOpen} onClick={() => setSidebar((s) => !s)} aria-pressed={!sidebar}>
                {sidebar ? 'Hide filters' : 'Show filters'}
              </Button>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="hidden size-4 text-muted sm:block" aria-hidden="true" />
                <label htmlFor="sort" className="sr-only">Sort by</label>
                <Select id="sort" size="sm" value={filters.sort || 'newest'} onChange={(e) => update({ sort: e.target.value })} className="w-48">
                  {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <div className="hidden rounded-lg border border-line bg-white p-0.5 lg:flex" role="group" aria-label="Layout">
                <button type="button" onClick={() => setLayout('grid')} aria-pressed={layout === 'grid'} aria-label="Grid view" className={cn('grid size-8 place-items-center rounded-md', layout === 'grid' ? 'bg-slate-100 text-ink' : 'text-muted')}><LayoutGrid className="size-4" /></button>
                <button type="button" onClick={() => setLayout('list')} aria-pressed={layout === 'list'} aria-label="List view" className={cn('grid size-8 place-items-center rounded-md', layout === 'list' ? 'bg-slate-100 text-ink' : 'text-muted')}><List className="size-4" /></button>
              </div>
            </div>
            <div className="mb-5"><FilterChips filters={filters} taxonomy={tax} onApply={setFilters} onClear={clearAll} locked={landing.locked} /></div>

            {error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : isLoading ? (
              <div className={cn('grid gap-5', sidebar ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>{Array.from({ length: 9 }, (_, i) => <VehicleCardSkeleton key={i} />)}</div>
            ) : data.items.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No cars match your filters"
                description="Try removing a filter, widening your budget or searching a different location."
                action={<><Button variant="primary" onClick={clearAll}>Clear filters</Button><Button variant="secondary" to="/cars">Browse all cars</Button></>}
              />
            ) : (
              <>
                <div className={cn('grid gap-4 transition-opacity sm:gap-5', isFetching && 'opacity-60', layout === 'list' ? 'grid-cols-1' : sidebar ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
                  {data.items.map((v, i) => <VehicleCard key={v.id} vehicle={v} priority={i < 2} layout={layout} />)}
                </div>
                <p className="mt-8 text-center text-sm text-muted">
                  Showing {formatNumber((data.page - 1) * data.pageSize + 1)}–{formatNumber(Math.min(data.total, data.page * data.pageSize))} of {formatNumber(data.total)}
                </p>
                <Pagination
                  className="mt-4"
                  page={data.page}
                  pageCount={data.pageCount}
                  hrefFor={(p) => {
                    const qs = toSearchParams({ ...filters, page: p }, landing.base || {}).toString()
                    return `${landing.path || '/cars'}${qs ? `?${qs}` : ''}`
                  }}
                />
              </>
            )}
            <LandingInsights landing={landing} stats={landingQuery.data?.stats} />
          </section>
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Filters"
        side="full"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDraft({ ...landing.base, sort: filters.sort })}>Clear all</Button>
            <Button className="flex-[2]" onClick={() => { setFilters({ ...draft, page: undefined }); setMobileOpen(false) }} loading={draftResults.isFetching}>
              Show {formatNumber(draftResults.data?.total ?? 0)} cars
            </Button>
          </div>
        }
      >
        <div className="px-5">
          <FilterPanel filters={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch, page: undefined }))} facets={draftResults.data?.facets} taxonomy={tax} locked={landing.locked} />
        </div>
      </Drawer>
    </>
  )
}

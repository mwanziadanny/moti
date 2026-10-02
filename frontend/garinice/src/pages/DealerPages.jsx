import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BadgeCheck, Building2, Car, Check, Clock, Globe, Mail, MapPin, Phone, SearchX, Share2, Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { WhatsAppIcon } from '../components/ui/BrandIcons'
import { Button } from '../components/ui/Button'
import { Avatar, Card } from '../components/ui/Data'
import { Badge, EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Checkbox, Input, Select } from '../components/ui/Form'
import { Breadcrumbs, Pagination } from '../components/ui/Navigation'
import { useToast } from '../components/ui/Toast'
import { VehicleGrid } from '../components/vehicle/VehicleCard'
import { useTaxonomy, useVehicleSearch } from '../hooks/queries'
import { Seo } from '../hooks/useSeo'
import { useCopyToClipboard, useDebounce, useFilters } from '../hooks/useUtils'
import { SITE, SORT_OPTIONS } from '../lib/constants'
import { toSearchParams } from '../lib/filters'
import { cn, formatCompactKES, formatNumber, toWhatsAppNumber } from '../lib/format'
import NotFoundPage from './NotFoundPage'

export function DealersPage() {
  const [params, setParams] = useSearchParams()
  const { data: tax } = useTaxonomy()
  const [q, setQ] = useState(params.get('q') || '')
  const dq = useDebounce(q, 250)
  const location = params.get('location') || ''
  const verified = params.get('verified') === '1'
  const page = Number(params.get('page')) || 1
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dealers', dq, location, verified, page],
    queryFn: () => api.dealers.list({ q: dq, location, verified: verified ? '1' : undefined, page }),
    placeholderData: keepPreviousData,
  })
  const setParam = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    next.delete('page')
    setParams(next, { replace: true })
  }
  return (
    <>
      <Seo title="Car dealers in Kenya" description="Browse car dealerships across Kenya on GariNice. View dealer inventory, verified status, locations and contact details." />
      <div className="border-b border-line bg-white">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Dealers' }]} />
          <h1 className="mt-3 text-3xl font-extrabold">Car dealers in Kenya</h1>
          <p className="mt-2 max-w-2xl text-muted">Browse dealer storefronts, see their full inventory and contact them directly. Verified badges are only given after our team checks business documents.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input aria-label="Search dealers" placeholder="Search by dealer name or town" value={q} onChange={(e) => { setQ(e.target.value); setParam('q', e.target.value) }} className="sm:max-w-sm" />
            <Select aria-label="Location" value={location} onChange={(e) => setParam('location', e.target.value)} className="sm:w-48">
              <option value="">All locations</option>
              {(tax?.locations || []).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
            </Select>
            <Checkbox label="Verified dealers only" checked={verified} onChange={(e) => setParam('verified', e.target.checked ? '1' : '')} />
          </div>
        </div>
      </div>
      <div className="container-page py-8">
        {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={Store} title="No dealers found" description="Try a different name or location." action={<Button variant="secondary" onClick={() => { setQ(''); setParams({}) }}>Clear search</Button>} />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((d) => (
                <li key={d.id}>
                  <Link to={`/dealer/${d.slug}`} className="flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift">
                    <div className="flex items-center gap-4">
                      <Avatar src={d.logoUrl} name={d.name} square size="lg" />
                      <div className="min-w-0">
                        <h2 className="flex items-center gap-1.5 font-semibold"><span className="truncate">{d.name}</span>{d.verified && <BadgeCheck className="size-4.5 shrink-0 text-teal-600" aria-label="Verified dealer" />}</h2>
                        <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden="true" />{d.town}</p>
                      </div>
                    </div>
                    {d.tagline && <p className="mt-4 line-clamp-2 text-sm text-slate-600">{d.tagline}</p>}
                    <div className="mt-auto flex items-center justify-between pt-4 text-sm">
                      <span className="font-semibold text-brand-700">{formatNumber(d.count)} cars</span>
                      <span className="text-muted">Since {d.since}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination className="mt-8" page={data.page} pageCount={data.pageCount} onChange={(p) => { const n = new URLSearchParams(params); n.set('page', p); setParams(n) }} />
          </>
        )}
        <div className="mt-14 rounded-2xl bg-brand-800 p-8 text-white sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Are you a dealer?</h2>
              <p className="mt-1 text-brand-100">Get a branded storefront, team accounts and analytics.</p>
            </div>
            <Button variant="accent" size="lg" to="/sell#dealers">See dealer packages</Button>
          </div>
        </div>
      </div>
    </>
  )
}

export function DealerPage() {
  const { slug } = useParams()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dealer', slug], queryFn: () => api.dealers.get(slug), retry: (n, e) => e.status !== 404 && n < 2 })
  const { filters, setFilters, update } = useFilters({ dealer: slug })
  const inventory = useVehicleSearch({ ...filters, pageSize: 12 }, { facets: true, enabled: !!data })
  const { data: tax } = useTaxonomy()
  const [copied, copy] = useCopyToClipboard()
  const toast = useToast()

  if (error?.status === 404) return <NotFoundPage kind="dealer" />
  if (error) return <div className="container-page py-16"><ErrorState error={error} onRetry={refetch} /></div>
  if (isLoading) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-40 w-full rounded-none" />
        <div className="container-page -mt-10 space-y-4"><Skeleton className="size-24 rounded-2xl" /><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      </div>
    )
  }
  const { dealer: d, stats } = data
  const url = `${SITE.url}/dealer/${d.slug}`
  const inv = inventory.data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: d.name,
    url,
    telephone: d.phone,
    email: d.email,
    address: { '@type': 'PostalAddress', streetAddress: d.address, addressLocality: d.town, addressRegion: d.county, addressCountry: 'KE' },
    openingHours: d.openingHours,
  }

  return (
    <>
      <Seo title={`${d.name} – Cars for sale in ${d.town}`} description={`${d.name}${d.verified ? ' (verified dealer)' : ''} in ${d.town}. Browse ${stats.activeListings} cars for sale${stats.minPrice ? ` from ${formatCompactKES(stats.minPrice)}` : ''}. ${d.tagline || ''}`} canonical={`/dealer/${d.slug}`} jsonLd={jsonLd} />
      <div className="relative h-36 sm:h-44" style={{ background: d.brandColour || '#123b5d' }}>
        <svg className="absolute inset-0 size-full text-white/[0.06]" aria-hidden="true"><defs><pattern id="dgrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="currentColor" /></pattern></defs><rect width="100%" height="100%" fill="url(#dgrid)" /></svg>
      </div>
      <div className="border-b border-line bg-white">
        <div className="container-page pb-6">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end">
            <Avatar src={d.logoUrl} name={d.name} square size="xl" className="size-24 shrink-0 shadow-lift ring-4 ring-white sm:size-28" />
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{d.name}</h1>
                {d.verified ? <Badge tone="teal" icon={BadgeCheck} size="md">Verified dealer</Badge> : <Badge tone="neutral">Not yet verified</Badge>}
              </div>
              {d.tagline && <p className="mt-1 text-muted">{d.tagline}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden="true" />{d.address || d.town}</span>
                {d.openingHours && <span className="inline-flex items-center gap-1"><Clock className="size-4" aria-hidden="true" />{d.openingHours}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {d.phone && <Button variant="secondary" icon={Phone} href={`tel:${d.phone}`} onClick={() => api.vehicles.event('PHONE_CLICK', null, { dealer: d.slug }).catch(() => {})}>Call</Button>}
              {d.whatsapp && <Button variant="teal" icon={WhatsAppIcon} href={`https://wa.me/${toWhatsAppNumber(d.whatsapp)}`} target="_blank" rel="noopener noreferrer" onClick={() => api.vehicles.event('WHATSAPP_CLICK', null, { dealer: d.slug }).catch(() => {})}>WhatsApp</Button>}
              {d.email && <Button variant="secondary" size="icon" href={`mailto:${d.email}`} aria-label={`Email ${d.name}`}><Mail className="size-4.5" /></Button>}
              <Button variant="secondary" size="icon" aria-label="Share storefront" onClick={async () => {
                if (navigator.share) { try { await navigator.share({ title: d.name, url }); return } catch { /* cancelled */ } }
                if (await copy(url)) toast.success('Storefront link copied')
              }}>{copied ? <Check className="size-4.5" /> : <Share2 className="size-4.5" />}</Button>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[Car, 'Cars available', formatNumber(stats.activeListings)], [Check, 'Cars sold', formatNumber(stats.soldListings)], [Building2, 'In business since', d.since], [MapPin, 'Price range', stats.minPrice ? `${formatCompactKES(stats.minPrice)} – ${formatCompactKES(stats.maxPrice)}` : '—']].map(([Icon, l, v]) => (
              <div key={l} className="rounded-lg bg-slate-50 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted"><Icon className="size-3.5" aria-hidden="true" />{l}</dt>
                <dd className="mt-0.5 font-display text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="container-page py-8">
        <Breadcrumbs items={[{ label: 'Dealers', to: '/dealers' }, { label: d.name }]} className="mb-6" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="inv-heading" className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 id="inv-heading" className="mr-auto text-xl font-bold">Inventory <span className="text-base font-normal text-muted">({formatNumber(inv?.total ?? stats.activeListings)})</span></h2>
              <Input size="sm" aria-label="Search this dealer’s cars" placeholder="Search this dealer…" defaultValue={filters.q || ''} onKeyDown={(e) => e.key === 'Enter' && update({ q: e.currentTarget.value || undefined })} className="w-52" />
              <Select size="sm" aria-label="Body type" value={filters.body || ''} onChange={(e) => update({ body: e.target.value || undefined })} className="w-40">
                <option value="">All body types</option>
                {(tax?.bodyTypes || []).filter((b) => inv?.facets?.body?.[b.slug] || filters.body === b.slug).map((b) => <option key={b.slug} value={b.slug}>{b.name} ({inv?.facets?.body?.[b.slug] || 0})</option>)}
              </Select>
              <Select size="sm" aria-label="Sort" value={filters.sort || 'newest'} onChange={(e) => update({ sort: e.target.value })} className="w-44">
                {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            {stats.brands.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by make">
                <button type="button" onClick={() => update({ make: undefined, model: undefined })} aria-pressed={!filters.make} className={cn('rounded-full border px-3 py-1 text-sm', !filters.make ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white hover:border-slate-400')}>All makes</button>
                {stats.brands.map((b) => (
                  <button key={b.slug} type="button" onClick={() => update({ make: filters.make === b.slug ? undefined : b.slug, model: undefined })} aria-pressed={filters.make === b.slug} className={cn('rounded-full border px-3 py-1 text-sm', filters.make === b.slug ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white hover:border-slate-400')}>
                    {b.name} <span className="opacity-70">{b.count}</span>
                  </button>
                ))}
              </div>
            )}
            {inventory.error ? <ErrorState error={inventory.error} onRetry={inventory.refetch} /> : inv && inv.items.length === 0 ? (
              <EmptyState icon={SearchX} title="No vehicles found" description="This dealer has no cars matching your filters right now." action={<Button variant="secondary" onClick={() => setFilters({ dealer: slug })}>Clear filters</Button>} />
            ) : (
              <>
                <VehicleGrid vehicles={inv?.items || []} loading={!inv} count={6} cols="sm:grid-cols-2 xl:grid-cols-3" />
                {inv && <Pagination className="mt-8" page={inv.page} pageCount={inv.pageCount} hrefFor={(p) => { const qs = toSearchParams({ ...filters, page: p }, { dealer: slug }).toString(); return `/dealer/${slug}${qs ? `?${qs}` : ''}` }} />}
              </>
            )}
            <p className="mt-8 text-center text-sm"><Link to={`/cars?dealer=${d.slug}`} className="font-medium text-teal-700 hover:underline">View {d.name}’s cars in the main marketplace with all filters →</Link></p>
          </section>
          <aside className="space-y-5">
            <Card>
              <h2 className="font-semibold">About {d.name}</h2>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-600">{d.description || 'This dealer hasn’t added a description yet.'}</p>
            </Card>
            <Card>
              <h2 className="font-semibold">Contact & location</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {d.address && <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" />{d.address}, {d.county}</li>}
                {d.phone && <li className="flex gap-2.5"><Phone className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" /><a href={`tel:${d.phone}`} className="hover:underline">{d.phone}</a></li>}
                {d.email && <li className="flex gap-2.5"><Mail className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" /><a href={`mailto:${d.email}`} className="break-all hover:underline">{d.email}</a></li>}
                {d.website && <li className="flex gap-2.5"><Globe className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" /><a href={d.website} target="_blank" rel="noopener noreferrer nofollow" className="break-all hover:underline">{d.website.replace(/^https?:\/\//, '')}</a></li>}
                {d.openingHours && <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" />{d.openingHours}</li>}
              </ul>
            </Card>
            {d.verified && (
              <Card className="bg-teal-50/60">
                <p className="flex items-center gap-2 text-sm font-semibold text-teal-800"><BadgeCheck className="size-5" aria-hidden="true" />Verified by {SITE.name}</p>
                <p className="mt-1 text-xs text-teal-900/80">Our team checked this dealer’s business registration and premises. Verification does not guarantee the condition of individual vehicles.</p>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}

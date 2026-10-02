import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, Flag, MessageSquareLock, Search, ShieldCheck, Sparkles, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { HeroSearch } from '../components/search/HeroSearch'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Data'
import { Alert, ErrorState, Skeleton } from '../components/ui/Feedback'
import { VehicleCard, VehicleGrid } from '../components/vehicle/VehicleCard'
import { useRecentlyViewed } from '../hooks/useUtils'
import { Seo } from '../hooks/useSeo'
import { resolveImageUrl } from '../lib/demoImages'
import { SITE } from '../lib/constants'
import { formatNumber } from '../lib/format'

function Section({ title, subtitle, action, children, className }) {
  return (
    <section className={className}>
      <div className="container-page py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-[28px]">{title}</h2>
            {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  )
}

const ViewAll = ({ to, children = 'View all' }) => (
  <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:gap-2.5 hover:underline">
    {children} <ArrowRight className="size-4 transition-all" aria-hidden="true" />
  </Link>
)

export default function HomePage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['home'], queryFn: api.catalog.home, staleTime: 60_000 })
  const recent = useRecentlyViewed()
  const hp = data?.settings
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    potentialAction: { '@type': 'SearchAction', target: `${SITE.url}/cars?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  }

  return (
    <>
      <Seo title={`${SITE.name} — Buy & sell new and used cars in Kenya`} canonical="/" jsonLd={jsonLd} />
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-800">
        <svg className="pointer-events-none absolute inset-0 size-full text-white/[0.04]" aria-hidden="true">
          <defs><pattern id="hero-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0v44" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
        <div className="container-page relative pt-12 pb-14 sm:pt-16 sm:pb-20 lg:pt-20">
          {hp?.announcement && <Alert tone="info" className="mb-6">{hp.announcement}</Alert>}
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-amber-300 uppercase ring-1 ring-white/15">
              <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" /> Kenya’s car marketplace
            </p>
            <h1 className="text-4xl leading-[1.08] font-extrabold text-white sm:text-5xl lg:text-6xl">{hp?.heroTitle || 'Find your next car'}</h1>
            <p className="mt-4 max-w-2xl text-lg text-brand-100">{hp?.heroSubtitle || 'Browse cars from trusted dealers and private sellers across Kenya.'}</p>
          </div>
          <div className="mt-8 sm:mt-10"><HeroSearch /></div>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-white">
            {[
              [isLoading ? '—' : formatNumber(data?.totalListings), 'cars listed'],
              [isLoading ? '—' : formatNumber(data?.dealerCount), 'dealers'],
              ['47', 'counties covered'],
            ].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-2">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{n}</dd>
                <span className="text-sm text-brand-200">{l}</span>
              </div>
            ))}
          </dl>
          {hp?.popularSearches?.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm text-brand-200">Popular:</span>
              {hp.popularSearches.map((p) => (
                <Link key={p.href} to={p.href} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white ring-1 ring-white/15 hover:bg-white/20">{p.label}</Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {error && <div className="container-page py-10"><ErrorState error={error} onRetry={refetch} /></div>}

      {/* Body types */}
      <Section title="Browse by body type" subtitle="Find the right shape for your lifestyle." action={<ViewAll to="/cars">All cars</ViewAll>}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {(isLoading ? Array.from({ length: 7 }) : data?.bodyTypes || []).map((b, i) => (
            <li key={b?.slug || i}>
              {b ? (
                <Link to={`/cars/body/${b.slug}`} className="group block rounded-xl border border-line bg-white p-3 text-center transition-all hover:-translate-y-0.5 hover:border-teal-600 hover:shadow-lift">
                  <img src={resolveImageUrl(`demo:${b.slug}/123b5d/0`)} alt="" className="mx-auto aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" width="200" height="150" />
                  <p className="mt-2 text-sm font-semibold text-ink">{b.name}</p>
                  <p className="text-xs text-muted">{formatNumber(b.count)} cars</p>
                </Link>
              ) : <Skeleton className="h-36" />}
            </li>
          ))}
        </ul>
      </Section>

      {/* Featured */}
      {(isLoading || data?.featured?.length > 0) && (
        <Section className="bg-white" title={<span className="inline-flex items-center gap-2"><Sparkles className="size-6 text-amber-500" aria-hidden="true" />Featured cars</span>} subtitle="Hand-picked listings promoted by sellers." action={<ViewAll to="/cars">Browse all</ViewAll>}>
          <VehicleGrid vehicles={data?.featured || []} loading={isLoading} count={4} />
        </Section>
      )}

      {/* Brands */}
      <Section title="Popular brands" subtitle="Shop the makes Kenyans love most.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(isLoading ? Array.from({ length: 10 }) : (data?.brands || []).slice(0, 10)).map((b, i) => (
            <li key={b?.slug || i}>
              {b ? (
                <Link to={`/cars/${b.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors hover:border-teal-600">
                  <span className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-brand-50 font-display text-sm font-extrabold text-brand-700" aria-hidden="true">{b.name.slice(0, 2).toUpperCase()}</span>
                    <span className="font-semibold">{b.name}</span>
                  </span>
                  <span className="text-sm text-muted tabular-nums">{b.count}</span>
                </Link>
              ) : <Skeleton className="h-[68px]" />}
            </li>
          ))}
        </ul>
      </Section>

      {/* Latest */}
      <Section className="bg-white" title="Latest listings" subtitle={data ? `${formatNumber(data.totalListings)} cars available right now` : 'Fresh on GariNice'} action={<ViewAll to="/cars">View all cars</ViewAll>}>
        <VehicleGrid vehicles={data?.latest || []} loading={isLoading} count={8} />
        <div className="mt-8 text-center"><Button variant="secondary" size="lg" to="/cars" iconRight={ArrowRight}>Browse {data ? formatNumber(data.totalListings) : ''} cars</Button></div>
      </Section>

      {/* Budget */}
      <Section title="Shop by budget">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {(data?.priceBands || []).map((p) => (
            <li key={p.slug}>
              <Link to={`/cars/price/${p.slug}`} className="block rounded-xl border border-line bg-white p-4 transition-colors hover:border-teal-600">
                <p className="font-semibold text-ink">{p.label}</p>
                <p className="mt-1 text-sm text-muted">{formatNumber(p.count)} cars</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Trust */}
      <section className="border-y border-line bg-white">
        <div className="container-page grid gap-8 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ShieldCheck, 'Moderated listings', 'Every listing is reviewed before it goes live.'],
            [BadgeCheck, 'Verified dealers', 'Verification badges only after manual document checks.'],
            [MessageSquareLock, 'Private messaging', 'Chat with sellers without sharing your number.'],
            [Flag, 'Report in one tap', 'Spotted something off? Our team acts on every report.'],
          ].map(([Icon, t, d]) => (
            <div key={t} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon className="size-5.5" aria-hidden="true" /></span>
              <div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Dealers */}
      {data?.dealers?.length > 0 && (
        <Section title="Trusted dealers" subtitle="Browse dealership inventory across Kenya." action={<ViewAll to="/dealers">All dealers</ViewAll>}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.dealers.map((d) => (
              <li key={d.id}>
                <Link to={`/dealer/${d.slug}`} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-teal-600">
                  <Avatar src={d.logoUrl} name={d.name} square size="lg" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-semibold"><span className="truncate">{d.name}</span>{d.verified && <BadgeCheck className="size-4 shrink-0 text-teal-600" aria-label="Verified dealer" />}</p>
                    <p className="text-sm text-muted">{d.town} · {d.count} cars</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Sell CTA */}
      <section className="container-page pb-16">
        <div className="relative overflow-hidden rounded-2xl bg-teal-700 px-6 py-10 text-white sm:px-12 sm:py-14">
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-3xl font-bold">Selling your car?</h2>
              <p className="mt-2 max-w-xl text-teal-50">List it free in about 10 minutes. Reach buyers across Kenya, chat securely, and manage everything from your dashboard.</p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-teal-50">
                {['Free basic listing', 'Premium boosts from KES 1,500', 'Dealer storefronts'].map((t) => <span key={t} className="inline-flex items-center gap-1.5"><BadgeCheck className="size-4" aria-hidden="true" />{t}</span>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="accent" size="lg" to="/sell/vehicle">List your car</Button>
              <Button size="lg" to="/sell" className="bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20" icon={Store}>Dealer packages</Button>
            </div>
          </div>
        </div>
      </section>

      {recent.items.length > 0 && (
        <Section className="bg-white" title="Recently viewed">
          <div className="flex snap-x gap-4 overflow-x-auto pb-2 scrollbar-none">
            {recent.items.slice(0, 8).map((v) => <div key={v.id} className="w-72 shrink-0 snap-start"><VehicleCard vehicle={v} /></div>)}
          </div>
        </Section>
      )}

      {/* SEO links */}
      <section className="container-page pb-16">
        <h2 className="text-lg font-bold">Popular searches in Kenya</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(data?.brands || []).slice(0, 12).map((b) => (
            <Link key={b.slug} to={`/cars/${b.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-teal-600"><Search className="size-3.5 text-slate-400" aria-hidden="true" />{b.name} for sale</Link>
          ))}
          {(data?.bodyTypes || []).map((b) => (
            <Link key={b.slug} to={`/cars/body/${b.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-teal-600"><Search className="size-3.5 text-slate-400" aria-hidden="true" />{b.plural} in Kenya</Link>
          ))}
        </div>
      </section>
    </>
  )
}

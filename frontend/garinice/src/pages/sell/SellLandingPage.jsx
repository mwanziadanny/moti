import { useQuery } from '@tanstack/react-query'
import { BarChart3, Camera, Check, ClipboardList, MessageSquare, ShieldCheck, Sparkles, Store, Users } from 'lucide-react'
import { api } from '../../api'
import { Button } from '../../components/ui/Button'
import { Badge, Skeleton } from '../../components/ui/Feedback'
import { useAuth } from '../../hooks/useAuth'
import { Seo } from '../../hooks/useSeo'
import { cn, formatKES, formatNumber } from '../../lib/format'

function PackageCard({ p, cta }) {
  return (
    <div className={cn('relative flex flex-col rounded-2xl border bg-white p-6 shadow-card', p.featured ? 'border-amber-400 ring-1 ring-amber-400' : 'border-line')}>
      {p.featured && <Badge tone="accent" icon={Sparkles} className="absolute -top-3 left-6">Best exposure</Badge>}
      <h3 className="text-lg font-bold">{p.name}</h3>
      <p className="mt-1 min-h-10 text-sm text-muted">{p.description}</p>
      <p className="mt-5 font-display text-3xl font-extrabold">{p.price ? formatKES(p.price) : 'Free'}{p.audience === 'DEALER' && <span className="text-base font-medium text-muted"> /{p.durationDays} days</span>}</p>
      <ul className="mt-5 space-y-2 text-sm">
        <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />{p.audience === 'DEALER' ? `Up to ${formatNumber(p.listingLimit)} active listings` : `${p.durationDays} days live`}</li>
        {p.boostDays > 0 && <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />{p.boostDays}-day search boost</li>}
        {p.featured && <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />Homepage featured placement</li>}
        {p.analytics && <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />Views & enquiry analytics</li>}
        <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />Secure in-app messaging</li>
      </ul>
      <div className="mt-auto pt-6">{cta}</div>
    </div>
  )
}

export default function SellLandingPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['packages'], queryFn: api.catalog.packages })
  const listing = (data?.items || []).filter((p) => p.audience !== 'DEALER')
  const dealer = (data?.items || []).filter((p) => p.audience === 'DEALER')
  return (
    <>
      <Seo title="Sell your car in Kenya" description="Sell your car fast on GariNice. List for free in about 10 minutes, reach buyers across Kenya and chat securely. Premium boosts and dealer packages available." />
      <section className="bg-brand-800 text-white">
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">Sell your car to serious buyers across Kenya</h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">Create a free listing in about 10 minutes. Buyers contact you through secure messaging — your number stays private unless you choose to share it.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" to="/sell/vehicle">List your car</Button>
              {!user?.dealer && <Button size="lg" to={user ? '/contact' : '/register?type=dealer'} className="bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20" icon={Store}>I’m a dealer</Button>}
            </div>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {[[ClipboardList, 'Add details', 'Make, model, mileage and specs — our wizard guides you.'], [Camera, 'Upload photos', 'Up to 20 photos. We optimise them automatically.'], [ShieldCheck, 'Quick review', 'We check every listing to keep buyers safe.'], [MessageSquare, 'Get enquiries', 'Chat with buyers and mark the car sold when done.']].map(([Icon, t, d], i) => (
              <li key={t} className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
                <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-amber-500 font-bold text-ink">{i + 1}</span><Icon className="size-5 text-amber-300" aria-hidden="true" /></div>
                <h2 className="mt-3 font-semibold">{t}</h2>
                <p className="mt-1 text-sm text-brand-100">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-bold">Listing packages</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted">Start free. Upgrade any listing to reach more buyers — pay securely with M-Pesa.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-2xl" />) : listing.map((p) => (
            <PackageCard key={p.id} p={p} cta={<Button block variant={p.featured ? 'accent' : 'primary'} to="/sell/vehicle">{p.price ? `Choose ${p.name}` : 'List for free'}</Button>} />
          ))}
        </div>
      </section>

      <section id="dealers" className="scroll-mt-20 border-y border-line bg-white">
        <div className="container-page py-16">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <Badge tone="brand" icon={Store}>For dealers</Badge>
              <h2 className="mt-3 text-3xl font-bold">Grow your dealership online</h2>
              <ul className="mt-6 space-y-4 text-slate-700">
                {[[Store, 'Branded storefront', 'Your own page with logo, inventory and contact details.'], [Users, 'Team accounts', 'Add sales staff to manage stock and reply to leads.'], [BarChart3, 'Analytics', 'See views, enquiries and conversion per car.'], [ShieldCheck, 'Verified badge', 'Get verified after a quick document check.']].map(([Icon, t, d]) => (
                  <li key={t} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" /><span><strong className="block text-ink">{t}</strong>{d}</span></li>
                ))}
              </ul>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {dealer.map((p) => (
                <PackageCard key={p.id} p={p} cta={<Button block variant={p.featured ? 'accent' : 'primary'} to={user?.dealer ? '/dashboard/payments' : '/register?type=dealer'}>{user?.dealer ? 'Buy package' : 'Create dealer account'}</Button>} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

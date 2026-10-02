import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, BadgeCheck, Calendar, Car, Check, Copy, Eye, Flag, Fuel, Gauge, Info, Mail, MapPin, MessageSquare, Pencil, Phone,
  Settings2, Share2, ShieldCheck, Store, User, Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { WhatsAppIcon } from '../components/ui/BrandIcons'
import { Button } from '../components/ui/Button'
import { Avatar, Card } from '../components/ui/Data'
import { Alert, Badge, ErrorState, Skeleton, StatusBadge } from '../components/ui/Feedback'
import { NumberInput } from '../components/ui/Form'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useToast } from '../components/ui/Toast'
import { MessageSellerDialog, ReportDialog } from '../components/vehicle/ContactDialogs'
import { Gallery } from '../components/vehicle/Gallery'
import { FavouriteButton, VehicleGrid } from '../components/vehicle/VehicleCard'
import { useAuth } from '../hooks/useAuth'
import { Seo } from '../hooks/useSeo'
import { useCopyToClipboard, useRecentlyViewed } from '../hooks/useUtils'
import { FEATURE_GROUP_LABELS, SITE } from '../lib/constants'
import { cn, formatDate, formatEngine, formatKES, formatMileage, formatNumber, maskPhone, timeAgo, toWhatsAppNumber } from '../lib/format'
import NotFoundPage from './NotFoundPage'

function SpecRow({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  )
}

function SpecSection({ title, children }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      <dl className="divide-y divide-line">{children}</dl>
    </div>
  )
}

function RunningCosts({ v }) {
  const e = v.estimates
  const [km, setKm] = useState('15000')
  const [fuelPrice, setFuelPrice] = useState(v.fuel === 'Diesel' ? '171' : '180')
  if (!e) return null
  const annualFuel = e.fuelCombinedKml ? Math.round((Number(km || 0) / e.fuelCombinedKml) * Number(fuelPrice || 0)) : null
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Running cost estimates</h2>
          <p className="mt-0.5 text-sm text-muted">A rough guide to help you budget.</p>
        </div>
        <Badge tone="warning" icon={Info}>Estimates only</Badge>
      </div>
      {e.fuelCombinedKml ? (
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[['Town', e.fuelTownKml], ['Highway', e.fuelHighwayKml], ['Combined', e.fuelCombinedKml]].map(([l, val]) => (
            <div key={l} className="rounded-lg bg-slate-50 p-3 text-center">
              <dt className="text-xs text-muted">{l}</dt>
              <dd className="mt-1 font-display text-lg font-bold">{val} <span className="text-xs font-medium text-muted">km/L</span></dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-4 text-sm text-muted">Fuel economy estimates are not available for electric vehicles.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-muted">Estimated annual comprehensive insurance</p>
          <p className="mt-1 font-display text-lg font-bold">{formatKES(e.insuranceAnnual)}</p>
          <p className="text-xs text-muted">Based on ~4% of the asking price; quotes vary by insurer and driver.</p>
        </div>
        {annualFuel != null && (
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted">Estimated annual fuel cost</p>
            <p className="mt-1 font-display text-lg font-bold">{formatKES(annualFuel)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumberInput size="sm" aria-label="Kilometres per year" value={km} onChange={setKm} suffix="km/yr" className="h-9 text-sm" />
              <NumberInput size="sm" aria-label="Fuel price per litre" value={fuelPrice} onChange={setFuelPrice} suffix="KES/L" className="h-9 text-sm" />
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 flex gap-2 text-xs text-muted"><AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />These figures are calculated by {SITE.name} from engine size, fuel type and body style. They are not manufacturer specifications or verified facts. Real-world costs depend on condition, driving style and roads.</p>
    </Card>
  )
}

function SellerPanel({ v, onMessage, onTrack }) {
  const { requireAuth } = useAuth()
  const [revealed, setRevealed] = useState(false)
  const sold = v.status === 'SOLD'
  const isDealer = v.seller.type === 'DEALER'
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar src={v.dealer?.logoUrl} name={v.seller.name} square={isDealer} size="lg" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            {isDealer ? <Link to={`/dealer/${v.dealer.slug}`} className="truncate hover:underline">{v.seller.name}</Link> : <span className="truncate">{v.seller.name}</span>}
            {v.seller.verified && <BadgeCheck className="size-5 shrink-0 text-teal-600" aria-hidden="true" />}
          </p>
          <p className="text-sm text-muted">{isDealer ? 'Dealer' : v.seller.type === 'AGENT' ? 'Selling on behalf of owner' : 'Private seller'}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {v.seller.verified ? (
          <Badge tone="teal" icon={ShieldCheck}>{isDealer ? 'Verified dealer' : 'Verified seller'}</Badge>
        ) : (
          <Badge tone="neutral">{isDealer ? 'Dealer — not yet verified' : 'Unverified private seller'}</Badge>
        )}
        <Badge tone="neutral" icon={MapPin}>{[v.area, v.town].filter(Boolean).join(', ')}</Badge>
      </div>
      {sold ? (
        <Alert tone="info" title="This car has been sold">Browse similar cars below.</Alert>
      ) : (
        <div className="grid gap-2.5">
          {v.contact.inApp && <Button size="lg" icon={MessageSquare} onClick={() => requireAuth('Sign in to message sellers. Your number stays private.', onMessage)}>Message seller</Button>}
          {v.contact.whatsapp && (
            <Button size="lg" variant="teal" icon={WhatsAppIcon} href={`https://wa.me/${toWhatsAppNumber(v.contact.whatsapp)}?text=${encodeURIComponent(`Hi, I'm interested in your ${v.title} (${SITE.url}/vehicle/${v.slug}) on ${SITE.name}.`)}`} target="_blank" rel="noopener noreferrer" onClick={() => onTrack('WHATSAPP_CLICK')}>
              WhatsApp
            </Button>
          )}
          {v.contact.phone && (revealed ? (
            <Button size="lg" variant="secondary" icon={Phone} href={`tel:${v.contact.phone}`} onClick={() => onTrack('PHONE_CLICK')}>{v.contact.phone}</Button>
          ) : (
            <Button size="lg" variant="secondary" icon={Phone} onClick={() => { setRevealed(true); onTrack('PHONE_CLICK') }}>Show number <span className="text-muted">{maskPhone(v.contact.phone)}</span></Button>
          ))}
          {v.contact.email && <Button size="lg" variant="secondary" icon={Mail} href={`mailto:${v.contact.email}?subject=${encodeURIComponent(`Enquiry: ${v.title} (${v.ref})`)}`} onClick={() => onTrack('EMAIL_CLICK')}>Email seller</Button>}
          {!v.contact.phone && !v.contact.whatsapp && <p className="text-xs text-muted">This seller has chosen not to show their phone number. Use in-app messaging to get in touch.</p>}
        </div>
      )}
      {isDealer && (
        <div className="border-t border-line pt-4 text-sm text-muted">
          {v.dealer.address && <p className="flex gap-2"><Store className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{v.dealer.address}</p>}
          <Link to={`/dealer/${v.dealer.slug}`} className="mt-2 inline-block font-semibold text-teal-700 hover:underline">View all cars from {v.dealer.name}</Link>
        </div>
      )}
    </Card>
  )
}

function ShareButton({ v, onTrack }) {
  const [copied, copy] = useCopyToClipboard()
  const toast = useToast()
  const url = `${SITE.url}/vehicle/${v.slug}`
  const share = async () => {
    onTrack('SHARE')
    if (navigator.share) {
      try {
        await navigator.share({ title: v.title, text: `${v.title} — ${formatKES(v.price)}`, url })
        return
      } catch {
        /* cancelled */
      }
    }
    if (await copy(url)) toast.success('Link copied to clipboard')
  }
  return (
    <div className="flex gap-2">
      <Button variant="secondary" icon={copied ? Check : Share2} onClick={share}>{copied ? 'Copied' : 'Share'}</Button>
      <Button variant="secondary" size="icon" href={`https://wa.me/?text=${encodeURIComponent(`${v.title} — ${formatKES(v.price)} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" onClick={() => onTrack('SHARE')}>
        <WhatsAppIcon className="size-4.5 text-[#128c7e]" />
      </Button>
      <Button variant="secondary" size="icon" aria-label="Copy link" onClick={async () => (await copy(url)) && toast.success('Link copied')}><Copy className="size-4" /></Button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading vehicle">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div><Skeleton className="aspect-[4/3] w-full rounded-xl" /><div className="mt-3 flex gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-24" />)}</div></div>
        <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-10 w-1/2" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full rounded-xl" /></div>
      </div>
    </div>
  )
}

export default function VehicleDetailPage() {
  const { slug } = useParams()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['vehicle', slug], queryFn: () => api.vehicles.get(slug), retry: (n, e) => e.status !== 404 && n < 2 })
  const v = data?.vehicle
  const related = useQuery({ queryKey: ['related', v?.id], queryFn: () => api.vehicles.related(v.id), enabled: !!v?.id })
  const [messageOpen, setMessageOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const recent = useRecentlyViewed()
  const tracked = useRef(null)
  const pushRecent = recent.push

  useEffect(() => {
    if (!v || tracked.current === v.id) return
    tracked.current = v.id
    if (v.status === 'PUBLISHED') {
      api.vehicles.view(v.id).catch(() => {})
      pushRecent({ id: v.id, slug: v.slug, title: v.title, year: v.year, make: v.make, model: v.model, variant: v.variant, image: v.images[0], imageCount: v.images.length, price: v.price, negotiable: v.negotiable, mileageKm: v.mileageKm, engineCc: v.engineCc, fuel: v.fuel, transmission: v.transmission, condition: v.condition, conditionLabel: v.conditionLabel, importStatus: v.importStatus, town: v.town, seller: v.seller, status: v.status })
    }
  }, [v, pushRecent])

  const track = (type) => api.vehicles.event(type, v.id).catch(() => {})
  const featuresByGroup = useMemo(() => {
    const g = {}
    for (const f of v?.features || []) (g[f.group] ||= []).push(f)
    return g
  }, [v])

  if (isLoading) return <DetailSkeleton />
  if (error?.status === 404) return <NotFoundPage kind="vehicle" />
  if (error) return <div className="container-page py-16"><ErrorState error={error} onRetry={refetch} /></div>

  const sold = v.status === 'SOLD'
  const isPublic = ['PUBLISHED', 'SOLD'].includes(v.status)
  const description = `${v.title} for sale in ${v.town} — ${formatKES(v.price)}. ${formatMileage(v.mileageKm)}, ${formatEngine(v.engineCc)} ${v.fuel}, ${v.transmission}, ${v.conditionLabel}. ${v.description.slice(0, 80)}…`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: v.title,
    url: `${SITE.url}/vehicle/${v.slug}`,
    brand: { '@type': 'Brand', name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    bodyType: v.bodyType,
    fuelType: v.fuel,
    vehicleTransmission: v.transmission,
    driveWheelConfiguration: v.driveType,
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.mileageKm, unitCode: 'KMT' },
    vehicleEngine: { '@type': 'EngineSpecification', engineDisplacement: { '@type': 'QuantitativeValue', value: v.engineCc, unitCode: 'CMQ' } },
    color: v.colour,
    numberOfAirbags: v.airbags,
    seatingCapacity: v.seats,
    itemCondition: v.condition === 'BRAND_NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    description: v.description,
    offers: {
      '@type': 'Offer',
      price: v.price,
      priceCurrency: 'KES',
      availability: sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      seller: { '@type': v.seller.type === 'DEALER' ? 'AutoDealer' : 'Person', name: v.seller.name },
      areaServed: v.county,
    },
  }

  return (
    <>
      <Seo title={`${v.title} for sale in ${v.town} – ${formatKES(v.price)}`} description={description} canonical={`/vehicle/${v.slug}`} image={v.images[0]?.url} type="product" noindex={!isPublic} jsonLd={jsonLd} />
      <div className="container-page pt-5 pb-28 lg:pb-16">
        <Breadcrumbs items={[{ label: 'Cars', to: '/cars' }, { label: v.make, to: `/cars/${v.makeSlug}` }, { label: v.model, to: `/cars?make=${v.makeSlug}&model=${v.modelSlug}` }, { label: v.title }]} />

        {data.canManage && (
          <Alert tone={v.status === 'PUBLISHED' ? 'info' : 'warning'} className="mt-4" title={<span className="flex items-center gap-2">You’re viewing your own listing <StatusBadge status={v.status} /></span>} action={<Button size="sm" variant="secondary" icon={Pencil} to={`/sell/vehicle?edit=${v.id}`}>Edit</Button>}>
            {v.status === 'PENDING_REVIEW' ? 'This listing is waiting for review and is not visible to buyers yet.' : v.status === 'PUBLISHED' ? `${formatNumber(v.views)} views so far.` : 'This listing is not visible to buyers.'}
            {v.changesRequested && <span className="mt-1 block font-medium">Changes requested: {v.changesRequested}</span>}
          </Alert>
        )}

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-8">
            <Gallery images={v.images} title={v.title} sold={sold} />

            {/* Mobile title block */}
            <div className="lg:hidden"><TitleBlock v={v} sold={sold} /></div>

            <Card>
              <h2 className="text-lg font-bold">Key details</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [Calendar, 'Year', v.year], [Gauge, 'Mileage', formatMileage(v.mileageKm)], [Zap, 'Engine', formatEngine(v.engineCc)], [Fuel, 'Fuel', v.fuel],
                  [Settings2, 'Transmission', v.transmission], [Car, 'Body', v.bodyType], [ShieldCheck, 'Condition', v.conditionLabel], [MapPin, 'Location', v.town],
                ].map(([Icon, l, val]) => (
                  <li key={l} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <Icon className="size-5 shrink-0 text-teal-700" aria-hidden="true" />
                    <span className="min-w-0"><span className="block text-xs text-muted">{l}</span><span className="block truncate text-sm font-semibold">{val}</span></span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="text-lg font-bold">Specifications</h2>
              <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
                <SpecSection title="General">
                  <SpecRow label="Year" value={v.year} />
                  <SpecRow label="Make" value={v.make} />
                  <SpecRow label="Model" value={v.model} />
                  <SpecRow label="Variant" value={v.variant} />
                  <SpecRow label="Condition" value={v.conditionLabel} />
                  <SpecRow label="Import status" value={v.importLabel} />
                  <SpecRow label="Body type" value={v.bodyType} />
                  <SpecRow label="Colour" value={v.colour} />
                </SpecSection>
                <div className="space-y-6">
                  <SpecSection title="Engine & drivetrain">
                    <SpecRow label="Engine capacity" value={formatEngine(v.engineCc)} />
                    <SpecRow label="Fuel" value={v.fuel} />
                    <SpecRow label="Transmission" value={v.transmission} />
                    <SpecRow label="Drive type" value={v.driveType} />
                    <SpecRow label="Power" value={v.powerHp ? `${v.powerHp} hp (seller-reported)` : null} />
                  </SpecSection>
                  <SpecSection title="Mileage">
                    <SpecRow label="Odometer" value={formatMileage(v.mileageKm)} />
                  </SpecSection>
                </div>
                <SpecSection title="Interior">
                  <SpecRow label="Seats" value={v.seats} />
                  <SpecRow label="Interior material" value={v.interiorMaterial} />
                  <SpecRow label="Airbags" value={v.airbags} />
                </SpecSection>
              </div>
              {Object.keys(featuresByGroup).length > 0 && (
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  {Object.entries(FEATURE_GROUP_LABELS).filter(([g]) => featuresByGroup[g]).map(([g, label]) => (
                    <div key={g}>
                      <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{label}</h3>
                      <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2 sm:gap-x-4">
                        {featuresByGroup[g].map((f) => <li key={f.slug} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />{f.name}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-lg font-bold">Seller’s description</h2>
              <p className="mt-3 text-[15px] leading-7 whitespace-pre-line text-slate-700">{v.description}</p>
              <p className="mt-4 text-xs text-muted">Information provided by the seller. Always inspect the vehicle and verify documents before paying.</p>
            </Card>

            <RunningCosts v={v} />

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Ref: <strong className="text-ink">{v.ref}</strong></span>
                {v.publishedAt && <span>Listed {timeAgo(v.publishedAt)}</span>}
                <span className="inline-flex items-center gap-1"><Eye className="size-4" aria-hidden="true" />{formatNumber(v.views)} views</span>
              </p>
              <button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1.5 font-medium text-danger hover:underline"><Flag className="size-4" aria-hidden="true" />Report this listing</button>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="hidden lg:block"><TitleBlock v={v} sold={sold} /></div>
            <div className="flex flex-wrap gap-2">
              <FavouriteButton vehicleId={v.id} withLabel />
              <ShareButton v={v} onTrack={track} />
            </div>
            <div className="lg:sticky lg:top-24 space-y-5">
              <SellerPanel v={v} onMessage={() => setMessageOpen(true)} onTrack={track} />
              <Card className="bg-amber-50/60">
                <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-amber-600" aria-hidden="true" />Stay safe</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  <li>Inspect the car in person before paying.</li>
                  <li>Never pay a deposit to “hold” a car you haven’t seen.</li>
                  <li>Verify the logbook with NTSA.</li>
                </ul>
                <Link to="/safety" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">More safety tips</Link>
              </Card>
            </div>
          </aside>
        </div>

        {related.data?.items?.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">Similar cars</h2>
            <VehicleGrid vehicles={related.data.items.slice(0, 4)} />
          </section>
        )}
      </div>

      {/* Sticky mobile actions */}
      {!sold && isPublic && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            {v.contact.phone && <Button variant="secondary" className="flex-1" icon={Phone} href={`tel:${v.contact.phone}`} onClick={() => track('PHONE_CLICK')}>Call</Button>}
            {v.contact.whatsapp && <Button variant="teal" className="flex-1" icon={WhatsAppIcon} href={`https://wa.me/${toWhatsAppNumber(v.contact.whatsapp)}?text=${encodeURIComponent(`Hi, I'm interested in your ${v.title} on ${SITE.name}.`)}`} target="_blank" rel="noopener noreferrer" onClick={() => track('WHATSAPP_CLICK')}>WhatsApp</Button>}
            {v.contact.inApp && <MobileMessageButton onOpen={() => setMessageOpen(true)} />}
          </div>
        </div>
      )}

      <MessageSellerDialog open={messageOpen} onClose={() => setMessageOpen(false)} vehicle={v} />
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} vehicle={v} />
    </>
  )
}

function MobileMessageButton({ onOpen }) {
  const { requireAuth } = useAuth()
  return <Button className="flex-1" icon={MessageSquare} onClick={() => requireAuth('Sign in to message sellers. Your number stays private.', onOpen)}>Message</Button>
}

function TitleBlock({ v, sold }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {v.featured && !sold && <Badge tone="accent">Featured</Badge>}
        {sold && <Badge tone="danger">Sold {v.soldAt ? formatDate(v.soldAt) : ''}</Badge>}
        <Badge tone={v.condition === 'BRAND_NEW' ? 'success' : v.condition === 'FOREIGN_USED' ? 'teal' : 'brand'}>{v.conditionLabel}</Badge>
        {v.importStatus !== 'LOCAL' && <Badge tone="info">{v.importLabel}</Badge>}
      </div>
      <h1 className="mt-3 text-2xl leading-tight font-extrabold sm:text-[28px]">{v.year} {v.make} {v.model}{v.variant ? <span className="font-bold text-slate-500"> {v.variant}</span> : null}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" aria-hidden="true" />{[v.area, v.town].filter(Boolean).join(', ')}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <p className={cn('font-display text-3xl font-extrabold tracking-tight tabular-nums', sold ? 'text-slate-400 line-through decoration-2' : 'text-brand-700')}>{formatKES(v.price)}</p>
        {v.negotiable && !sold && <Badge tone="teal" size="md">Negotiable</Badge>}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1"><Gauge className="size-4 text-slate-400" aria-hidden="true" />{formatMileage(v.mileageKm)}</span>
        <span className="inline-flex items-center gap-1"><Zap className="size-4 text-slate-400" aria-hidden="true" />{formatEngine(v.engineCc)}</span>
        <span className="inline-flex items-center gap-1"><Fuel className="size-4 text-slate-400" aria-hidden="true" />{v.fuel}</span>
        <span className="inline-flex items-center gap-1"><Settings2 className="size-4 text-slate-400" aria-hidden="true" />{v.transmission}</span>
        <span className="inline-flex items-center gap-1"><User className="size-4 text-slate-400" aria-hidden="true" />{v.seller.type === 'DEALER' ? 'Dealer' : 'Private'}</span>
      </p>
    </div>
  )
}

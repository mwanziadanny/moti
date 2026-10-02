import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, Clock, FileText, Info, Save, Sparkles, Store, Upload, User, Users, Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Data'
import { Alert, Badge, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { ChipToggle, Field, Input, NumberInput, PriceInput, RadioCards, Select, Switch, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Gallery } from '../../components/vehicle/Gallery'
import { VehicleCard } from '../../components/vehicle/VehicleCard'
import { FullPageSpinner } from '../../features/auth/Guards'
import { ImageUploader } from '../../features/listing/ImageUploader'
import { PaymentDialog } from '../../features/payments/PaymentDialog'
import { useTaxonomy } from '../../hooks/queries'
import { useAuth } from '../../hooks/useAuth'
import { Seo } from '../../hooks/useSeo'
import { COLOURS, CONDITIONS, DRIVE_TYPES, FEATURE_GROUP_LABELS, IMPORT_STATUSES, INTERIOR_MATERIALS, LIMITS } from '../../lib/constants'
import { cn, formatCompactKES, formatEngine, formatKES, formatMileage } from '../../lib/format'
import { fileToDataUrl } from '../../lib/image'
import { LISTING_STEPS, validateStep } from '../../lib/schemas'

const localPhone = (p) => (p?.startsWith('+254') ? `0${p.slice(4)}` : p || '')

function emptyValues(user) {
  const phone = localPhone(user.dealer ? user.phone : user.phone)
  return {
    sellerType: user.dealer ? 'DEALER' : 'PRIVATE', authorityDocUrl: null, brandId: '', modelId: '', variant: '', year: '', bodyTypeId: '',
    condition: '', importStatus: 'LOCAL', engineCc: '', fuelTypeId: '', transmissionId: '', driveType: '2WD', powerHp: '', mileageKm: '',
    seats: '', airbags: '', interiorMaterial: '', colour: '', features: [], price: '', negotiable: false,
    county: '', town: '', area: '', images: [], description: '',
    contact: { inApp: true, phone: !!phone, whatsapp: !!phone, email: false, phoneNumber: phone, whatsappNumber: phone },
  }
}

function fromVehicle(v) {
  const s = (x) => (x == null ? '' : String(x))
  return {
    sellerType: v.sellerType, authorityDocUrl: v.authorityDocUrl, brandId: v.brandId, modelId: v.modelId, variant: v.variant || '', year: s(v.year),
    bodyTypeId: v.bodyTypeId, condition: v.condition, importStatus: v.importStatus, engineCc: s(v.engineCc), fuelTypeId: v.fuelTypeId,
    transmissionId: v.transmissionId, driveType: v.driveType, powerHp: s(v.powerHp), mileageKm: s(v.mileageKm), seats: s(v.seats), airbags: s(v.airbags),
    interiorMaterial: v.interiorMaterial || '', colour: v.colour || '', features: v.rawFeatures || [], price: s(v.price), negotiable: !!v.negotiable,
    county: v.county, town: v.town, area: v.area || '', images: v.images, description: v.description,
    contact: { ...v.contactPrefs, phoneNumber: localPhone(v.contactPrefs?.phoneNumber), whatsappNumber: localPhone(v.contactPrefs?.whatsappNumber) },
  }
}

/** Builds a card-shaped preview object from form values + taxonomy. */
function previewCard(values, tax, user) {
  const brand = tax.brands.find((b) => b.id === values.brandId)
  const model = tax.models.find((m) => m.id === values.modelId)
  const cond = CONDITIONS.find((c) => c.value === values.condition)
  return {
    id: 'preview', slug: '#', title: [values.year, brand?.name, model?.name, values.variant].filter(Boolean).join(' '),
    year: values.year, make: brand?.name, model: model?.name, variant: values.variant, bodyType: tax.bodyTypes.find((b) => b.id === values.bodyTypeId)?.name,
    mileageKm: Number(values.mileageKm) || 0, engineCc: Number(values.engineCc) || 0, fuel: tax.fuelTypes.find((f) => f.id === values.fuelTypeId)?.name,
    transmission: tax.transmissions.find((t) => t.id === values.transmissionId)?.name, condition: values.condition, conditionLabel: cond?.label,
    importStatus: values.importStatus, price: Number(values.price) || 0, negotiable: values.negotiable, image: values.images[0], imageCount: values.images.length,
    town: values.town, status: 'PUBLISHED',
    seller: { type: user.dealer ? 'DEALER' : values.sellerType, name: user.dealer?.name || user.name.split(' ')[0], verified: user.dealer?.verified || user.verified },
  }
}

function generateDescription(values, tax) {
  const card = previewCard(values, tax, { name: '', dealer: null })
  const feats = tax.features.filter((f) => values.features.includes(f.slug)).map((f) => f.name.toLowerCase())
  const cond = { KENYAN_USED: 'Locally used and well maintained', FOREIGN_USED: 'Recently imported (foreign used)', BRAND_NEW: 'Brand new' }[values.condition] || ''
  return [
    `${card.title}${values.colour ? ` in ${values.colour.toLowerCase()}` : ''}. ${cond}${values.mileageKm ? ` with ${formatMileage(Number(values.mileageKm))} on the clock` : ''}.`,
    `${formatEngine(Number(values.engineCc))} ${card.fuel?.toLowerCase() || ''} engine, ${card.transmission?.toLowerCase() || ''} transmission, ${values.driveType}.`,
    feats.length ? `Features include ${feats.slice(0, 10).join(', ')}.` : '',
    `Viewing available in ${values.town || 'our location'}. Serious buyers are welcome to inspect the vehicle before purchase.`,
  ].filter(Boolean).join(' ')
}

function Stepper({ step, maxReached, onJump }) {
  return (
    <nav aria-label="Listing steps">
      <ol className="space-y-1">
        {LISTING_STEPS.map((s, i) => {
          const done = i < step
          const current = i === step
          const reachable = i <= maxReached
          return (
            <li key={s.id}>
              <button type="button" disabled={!reachable} onClick={() => onJump(i)} aria-current={current ? 'step' : undefined} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors', current ? 'bg-brand-50 font-semibold text-brand-700' : reachable ? 'text-ink hover:bg-slate-100' : 'text-slate-400')}>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', done ? 'bg-teal-600 text-white' : current ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-500')}>
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function PriceGuidance({ values, tax }) {
  const brand = tax.brands.find((b) => b.id === values.brandId)
  const model = tax.models.find((m) => m.id === values.modelId)
  const y = Number(values.year)
  const { data } = useQuery({
    queryKey: ['price-guide', brand?.slug, model?.slug, y],
    queryFn: () => api.vehicles.search({ make: brand.slug, model: model.slug, minYear: y - 1, maxYear: y + 1, pageSize: 60, sort: 'price_asc' }),
    enabled: !!(brand && model && y),
    staleTime: 5 * 60_000,
  })
  if (!data || data.items.length < 2) return null
  const prices = data.items.map((v) => v.price).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]
  const price = Number(values.price)
  return (
    <Alert tone="info" title="Market guide">
      {data.total} similar {brand.name} {model.name} ({y - 1}–{y + 1}) are listed between <strong>{formatCompactKES(prices[0])}</strong> and <strong>{formatCompactKES(prices.at(-1))}</strong>, with a typical price of <strong>{formatCompactKES(median)}</strong>.
      {price > 0 && price > median * 1.35 && <span className="mt-1 block">Your price is well above similar listings — buyers may skip it.</span>}
      {price > 0 && price < median * 0.6 && <span className="mt-1 block">Your price is far below similar listings. Unusually low prices are flagged for review.</span>}
    </Alert>
  )
}

function Wizard({ initial, vehicleId: initialId, user, tax, existingStatus }) {
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const draftKey = `gn_listing_draft_${user.id}`
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(initialId ? LISTING_STEPS.length - 1 : 0)
  const [vehicleId, setVehicleId] = useState(initialId)
  const [result, setResult] = useState(null)
  const [paying, setPaying] = useState(null)
  const [restored, setRestored] = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const topRef = useRef(null)
  const { data: pkgData } = useQuery({ queryKey: ['packages'], queryFn: api.catalog.packages })
  const listingPackages = (pkgData?.items || []).filter((p) => p.audience !== 'DEALER')
  const [packageId, setPackageId] = useState(null)
  const selectedPkg = listingPackages.find((p) => p.id === packageId) || listingPackages[0]
  const { data: quota } = useQuery({ queryKey: ['quota'], queryFn: api.vehicles.quota })

  // Restore / autosave local draft for new listings.
  useEffect(() => {
    if (initialId) return
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved?.values) {
        setValues({ ...initial, ...saved.values })
        setStep(saved.step || 0)
        setMaxReached(saved.maxReached || 0)
        if (saved.vehicleId) setVehicleId(saved.vehicleId)
        setRestored(true)
      }
    } catch {
      /* ignore */
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialId || result) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ values, step, maxReached, vehicleId }))
      } catch {
        /* quota */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [values, step, maxReached, vehicleId, draftKey, initialId, result])

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => {
      if (!Object.keys(e).some((k) => k === name || k.startsWith(`${name}.`))) return e
      const n = { ...e }
      Object.keys(n).forEach((k) => (k === name || k.startsWith(`${name}.`)) && delete n[k])
      return n
    })
  }
  const setContact = (k, v) => set('contact', { ...values.contact, [k]: v })
  const current = LISTING_STEPS[step]

  const goTo = (i) => {
    setStep(i)
    setMaxReached((m) => Math.max(m, i))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const next = () => {
    const r = validateStep(current.id, values)
    if (!r.success) {
      setErrors(r.errors)
      toast.error('Please fix the highlighted fields')
      return
    }
    setErrors({})
    goTo(step + 1)
  }

  // Drop empty values so partial drafts validate; the server re-validates everything on submit.
  const payload = () => {
    const out = {}
    for (const [k, v] of Object.entries(values)) {
      if (v === '' || v == null || (k === 'images' && !v.length)) continue
      out[k] = v
    }
    out.authorityDocUrl = values.sellerType === 'AGENT' ? values.authorityDocUrl : null
    return out
  }
  const saveDraft = useMutation({
    mutationFn: async () => {
      if (vehicleId) return api.vehicles.update(vehicleId, payload(), false)
      return api.vehicles.create(payload(), false)
    },
    onSuccess: (res) => {
      setVehicleId(res.vehicle.id)
      qc.invalidateQueries({ queryKey: ['my-vehicles'] })
    },
  })
  const submit = useMutation({
    mutationFn: (id) => api.vehicles.update(id, payload(), true),
    onSuccess: (res) => {
      setResult(res)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ['my-vehicles'] })
      qc.invalidateQueries({ queryKey: ['quota'] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      qc.invalidateQueries({ queryKey: ['vehicle'] })
    },
    onError: (err) => {
      if (err.fieldErrors) {
        setErrors(err.fieldErrors)
        const firstStep = LISTING_STEPS.findIndex((s) => s.fields.some((f) => Object.keys(err.fieldErrors).some((k) => k.split('.')[0] === f)))
        if (firstStep >= 0) goTo(firstStep)
      }
    },
  })

  const publish = async () => {
    for (const s of LISTING_STEPS) {
      const r = validateStep(s.id, values)
      if (!r.success) {
        setErrors(r.errors)
        goTo(LISTING_STEPS.indexOf(s))
        toast.error(`Please complete “${s.title}”`)
        return
      }
    }
    try {
      const saved = await saveDraft.mutateAsync()
      const v = saved.vehicle
      if (selectedPkg && selectedPkg.price > 0 && !user.dealer) setPaying(v)
      else submit.mutate(v.id)
    } catch (err) {
      toast.error('Couldn’t save your listing', { description: err.message })
    }
  }

  const brand = tax.brands.find((b) => b.id === values.brandId)
  const models = tax.models.filter((m) => m.brandId === values.brandId)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - LIMITS.minYear + 2 }, (_, i) => currentYear + 1 - i)
  const card = useMemo(() => previewCard(values, tax, user), [values, tax, user])
  const err = (k) => errors[k]

  if (result) {
    const live = result.status === 'PUBLISHED'
    const pending = result.status === 'PENDING_REVIEW'
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className={cn('mx-auto grid size-16 place-items-center rounded-full', live ? 'bg-green-50 text-success' : 'bg-amber-50 text-amber-600')}>
          {live ? <CheckCircle2 className="size-9" /> : <Clock className="size-9" />}
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">{live ? (initialId ? 'Changes saved' : 'Your car is live!') : pending ? 'Submitted for review' : 'Changes saved'}</h1>
        <p className="mt-3 text-muted">{!live && !pending ? `Your listing is currently ${result.status.toLowerCase().replace('_', ' ')}. You can manage it from My listings.` : live ? 'Buyers can now find your listing. We’ll notify you when someone sends a message.' : 'Our team reviews new listings to keep the marketplace safe — usually within a few hours. We’ll notify you as soon as it’s approved.'}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to={`/vehicle/${result.vehicle.slug}`}>View listing</Button>
          <Button variant="secondary" to="/dashboard/listings">Go to my listings</Button>
          <Button variant="ghost" onClick={() => { setResult(null); setValues(emptyValues(user)); setVehicleId(null); setStep(0); setMaxReached(0); navigate('/sell/vehicle') }}>List another car</Button>
        </div>
      </div>
    )
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Step {step + 1} of {LISTING_STEPS.length}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{initialId ? 'Edit listing' : 'List your car'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {existingStatus && <Badge tone="neutral">Current status: {existingStatus.replace('_', ' ').toLowerCase()}</Badge>}
          <Button variant="secondary" size="sm" icon={Save} loading={saveDraft.isPending} onClick={() => saveDraft.mutate(undefined, { onSuccess: () => toast.success('Draft saved', { description: 'Find it anytime in My listings.' }), onError: (e) => toast.error('Couldn’t save draft', { description: e.message }) })}>Save draft</Button>
        </div>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-200 lg:hidden" role="progressbar" aria-valuemin={1} aria-valuemax={LISTING_STEPS.length} aria-valuenow={step + 1} aria-label="Listing progress">
        <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${((step + 1) / LISTING_STEPS.length) * 100}%` }} />
      </div>
      {restored && <Alert tone="info" className="mb-5" action={<button type="button" className="text-sm font-semibold underline" onClick={() => { localStorage.removeItem(draftKey); setValues(initial); setStep(0); setMaxReached(0); setVehicleId(null); setRestored(false) }}>Start over</button>}>We restored your unfinished listing.</Alert>}

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block"><div className="sticky top-24"><Stepper step={step} maxReached={maxReached} onJump={(i) => (i < step ? goTo(i) : i <= maxReached && next())} /></div></aside>
        <div className="min-w-0">
          <Card>
            <h2 className="mb-1 text-xl font-bold">{current.title}</h2>
            <div className="mt-5 space-y-6">
              {current.id === 'seller' && (
                <>
                  <RadioCards
                    name="sellerType"
                    value={values.sellerType}
                    onChange={(v) => set('sellerType', v)}
                    columns={3}
                    error={err('sellerType')}
                    options={[
                      { value: 'PRIVATE', label: 'Private seller', description: 'I own this car', icon: User },
                      { value: 'DEALER', label: 'Dealer', description: user.dealer ? user.dealer.name : 'Requires a dealer account', icon: Store },
                      { value: 'AGENT', label: 'On behalf of owner', description: 'I’m selling for someone else', icon: Users },
                    ].filter((o) => (user.dealer ? o.value === 'DEALER' : o.value !== 'DEALER'))}
                  />
                  {!user.dealer && <p className="text-sm text-muted">Are you a dealership? <Link to="/sell#dealers" className="font-medium text-teal-700 hover:underline">Create a dealer account</Link> for a storefront and bulk listings.</p>}
                  {values.sellerType === 'AGENT' && (
                    <Field label="Authority to Sell document" required error={err('authorityDocUrl')} hint="A signed letter from the owner authorising you to sell this vehicle (PDF, JPG or PNG, max 5MB). Only our moderators can see it.">
                      {(p) => (
                        <div className="flex flex-wrap items-center gap-3">
                          <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50', docUploading && 'opacity-60')}>
                            <Upload className="size-4" aria-hidden="true" />{docUploading ? 'Uploading…' : values.authorityDocUrl ? 'Replace document' : 'Upload document'}
                            <input id={p.id} type="file" accept={LIMITS.acceptedDocTypes.join(',')} className="sr-only" aria-describedby={p['aria-describedby']} onChange={async (e) => {
                              const f = e.target.files?.[0]
                              e.target.value = ''
                              if (!f) return
                              if (f.size > LIMITS.maxDocumentBytes) return setErrors((x) => ({ ...x, authorityDocUrl: 'Document must be under 5MB' }))
                              setDocUploading(true)
                              try {
                                const up = await api.vehicles.upload({ kind: 'document', dataUrl: await fileToDataUrl(f), mime: f.type, name: f.name })
                                set('authorityDocUrl', up.id)
                                toast.success('Document uploaded')
                              } catch (ex) {
                                setErrors((x) => ({ ...x, authorityDocUrl: ex.message }))
                              } finally {
                                setDocUploading(false)
                              }
                            }} />
                          </label>
                          {values.authorityDocUrl && <span className="inline-flex items-center gap-1.5 text-sm text-success"><FileText className="size-4" aria-hidden="true" />Document attached</span>}
                        </div>
                      )}
                    </Field>
                  )}
                </>
              )}

              {current.id === 'basics' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Make" required error={err('brandId')}>
                    {(p) => <Select {...p} name="brandId" value={values.brandId} onChange={(e) => { set('brandId', e.target.value); set('modelId', '') }} placeholder="Select make">{tax.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>}
                  </Field>
                  <Field label="Model" required error={err('modelId')}>
                    {(p) => <Select {...p} name="modelId" value={values.modelId} disabled={!brand} onChange={(e) => {
                      const m = models.find((x) => x.id === e.target.value)
                      set('modelId', e.target.value)
                      if (m?.bodyTypeId && !values.bodyTypeId) set('bodyTypeId', m.bodyTypeId)
                    }} placeholder={brand ? 'Select model' : 'Select a make first'}>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}
                  </Field>
                  <Field label="Variant / trim" optional hint="e.g. TX-L, Hybrid, Double Cab">{(p) => <Input {...p} value={values.variant} onChange={(e) => set('variant', e.target.value)} maxLength={40} />}</Field>
                  <Field label="Year of manufacture" required error={err('year')}>
                    {(p) => <Select {...p} name="year" value={values.year} onChange={(e) => set('year', e.target.value)} placeholder="Select year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>}
                  </Field>
                  <Field label="Body type" required error={err('bodyTypeId')}>
                    {(p) => <Select {...p} name="bodyTypeId" value={values.bodyTypeId} onChange={(e) => set('bodyTypeId', e.target.value)} placeholder="Select body type">{tax.bodyTypes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>}
                  </Field>
                  <Field label="Import status" required error={err('importStatus')}>
                    {(p) => <Select {...p} value={values.importStatus} onChange={(e) => set('importStatus', e.target.value)}>{IMPORT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>}
                  </Field>
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium">Condition <span className="text-danger">*</span></legend>
                    <RadioCards name="condition" value={values.condition} onChange={(v) => set('condition', v)} columns={3} error={err('condition')} options={CONDITIONS.map((c) => ({ value: c.value, label: c.label, description: { KENYAN_USED: 'Registered & driven in Kenya', FOREIGN_USED: 'Used abroad, imported', BRAND_NEW: 'Never registered' }[c.value] }))} />
                    {err('condition') && <p className="mt-1.5 text-xs font-medium text-danger">{err('condition')}</p>}
                  </fieldset>
                </div>
              )}

              {current.id === 'technical' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Engine capacity" required error={err('engineCc')}>{(p) => <NumberInput {...p} name="engineCc" value={values.engineCc} onChange={(v) => set('engineCc', v)} suffix="cc" placeholder="e.g. 1500" />}</Field>
                  <Field label="Mileage" required error={err('mileageKm')}>{(p) => <NumberInput {...p} name="mileageKm" value={values.mileageKm} onChange={(v) => set('mileageKm', v)} suffix="km" placeholder="e.g. 85,000" />}</Field>
                  <Field label="Fuel type" required error={err('fuelTypeId')}>
                    {(p) => <Select {...p} name="fuelTypeId" value={values.fuelTypeId} onChange={(e) => set('fuelTypeId', e.target.value)} placeholder="Select fuel">{tax.fuelTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>}
                  </Field>
                  <Field label="Transmission" required error={err('transmissionId')}>
                    {(p) => <Select {...p} name="transmissionId" value={values.transmissionId} onChange={(e) => set('transmissionId', e.target.value)} placeholder="Select transmission">{tax.transmissions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
                  </Field>
                  <Field label="Drive type" required error={err('driveType')}>
                    {(p) => <Select {...p} value={values.driveType} onChange={(e) => set('driveType', e.target.value)}>{DRIVE_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select>}
                  </Field>
                  <Field label="Power" optional error={err('powerHp')}>{(p) => <NumberInput {...p} value={values.powerHp} onChange={(v) => set('powerHp', v)} suffix="hp" />}</Field>
                  <Field label="Seats" optional error={err('seats')}>{(p) => <NumberInput {...p} value={values.seats} onChange={(v) => set('seats', v)} />}</Field>
                  <Field label="Airbags" optional error={err('airbags')}>{(p) => <NumberInput {...p} value={values.airbags} onChange={(v) => set('airbags', v)} />}</Field>
                  <Field label="Interior material" optional>{(p) => <Select {...p} value={values.interiorMaterial} onChange={(e) => set('interiorMaterial', e.target.value)} placeholder="Select">{INTERIOR_MATERIALS.map((m) => <option key={m}>{m}</option>)}</Select>}</Field>
                  <Field label="Colour" optional>{(p) => <Select {...p} value={values.colour} onChange={(e) => set('colour', e.target.value)} placeholder="Select colour">{COLOURS.map((c) => <option key={c.name}>{c.name}</option>)}</Select>}</Field>
                </div>
              )}

              {current.id === 'features' && (
                <div className="space-y-6">
                  <p className="text-sm text-muted">Select everything this car has. Listings with complete features get more enquiries.</p>
                  {Object.entries(FEATURE_GROUP_LABELS).map(([g, label]) => (
                    <fieldset key={g}>
                      <legend className="mb-3 text-sm font-semibold">{label}</legend>
                      <div className="flex flex-wrap gap-2">
                        {tax.features.filter((f) => f.group === g).map((f) => (
                          <ChipToggle key={f.slug} label={f.name} selected={values.features.includes(f.slug)} onToggle={() => set('features', values.features.includes(f.slug) ? values.features.filter((x) => x !== f.slug) : [...values.features, f.slug])} />
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}

              {current.id === 'pricing' && (
                <div className="max-w-lg space-y-5">
                  <Field label="Asking price" required error={err('price')} hint="Enter the full price in Kenyan shillings.">{(p) => <PriceInput {...p} name="price" value={values.price} onChange={(v) => set('price', v)} size="lg" />}</Field>
                  {Number(values.price) > 0 && <p className="-mt-3 text-sm font-medium text-brand-700">{formatKES(Number(values.price))}</p>}
                  <Switch label="Price is negotiable" description="Shows a “Negotiable” badge on your listing." checked={values.negotiable} onChange={(v) => set('negotiable', v)} />
                  <PriceGuidance values={values} tax={tax} />
                </div>
              )}

              {current.id === 'location' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="County" required error={err('county')}>
                    {(p) => <Select {...p} name="county" value={values.county} onChange={(e) => set('county', e.target.value)} placeholder="Select county">{tax.counties.map((c) => <option key={c}>{c}</option>)}</Select>}
                  </Field>
                  <Field label="Town" required error={err('town')}>
                    {(p) => (
                      <>
                        <Input {...p} name="town" list="towns" value={values.town} onChange={(e) => set('town', e.target.value)} placeholder="e.g. Nairobi" />
                        <datalist id="towns">{tax.locations.map((l) => <option key={l.slug} value={l.name} />)}</datalist>
                      </>
                    )}
                  </Field>
                  <Field label="Area / estate" optional className="sm:col-span-2" hint="Don’t include your exact address. Share it with serious buyers in messages.">{(p) => <Input {...p} value={values.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Kilimani" />}</Field>
                </div>
              )}

              {current.id === 'images' && <ImageUploader images={values.images} onChange={(imgs) => set('images', imgs)} error={err('images')} />}

              {current.id === 'description' && (
                <div className="space-y-3">
                  <Field label="Description" required error={err('description')} hint={`${values.description.length}/5000 characters · minimum 30`}>
                    {(p) => <Textarea {...p} name="description" value={values.description} onChange={(e) => set('description', e.target.value)} rows={9} maxLength={5000} placeholder="Describe the car’s condition, service history, recent repairs, and why you’re selling." />}
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="subtle" size="sm" icon={Wand2} onClick={() => set('description', generateDescription(values, tax))}>Write a starting draft from my details</Button>
                    <span className="text-xs text-muted">Edit it to add your own details — honest descriptions sell faster.</span>
                  </div>
                  <Alert tone="info" title="Tips">Mention service history, tyres, any accidents or repairs, and whether the logbook is ready for transfer. Don’t include phone numbers or links — use the contact step instead.</Alert>
                </div>
              )}

              {current.id === 'contact' && (
                <div className="max-w-xl space-y-5">
                  {err('inApp') && <Alert tone="danger">{err('inApp')}</Alert>}
                  {err('contact.inApp') && <Alert tone="danger">{err('contact.inApp')}</Alert>}
                  <Switch label="In-app messaging" description="Recommended. Buyers message you securely without seeing your number." checked={values.contact.inApp} onChange={(v) => setContact('inApp', v)} />
                  <div className="space-y-3">
                    <Switch label="Show phone number" description="Buyers can call you directly. Your number is hidden until they tap “Show number”." checked={values.contact.phone} onChange={(v) => setContact('phone', v)} />
                    {values.contact.phone && <Field label="Phone number" error={err('contact.phoneNumber')} required>{(p) => <Input {...p} type="tel" value={values.contact.phoneNumber} onChange={(e) => setContact('phoneNumber', e.target.value)} placeholder="0712 345 678" />}</Field>}
                  </div>
                  <div className="space-y-3">
                    <Switch label="WhatsApp" description="Buyers can start a WhatsApp chat." checked={values.contact.whatsapp} onChange={(v) => setContact('whatsapp', v)} />
                    {values.contact.whatsapp && <Field label="WhatsApp number" error={err('contact.whatsappNumber')} required>{(p) => <Input {...p} type="tel" value={values.contact.whatsappNumber} onChange={(e) => setContact('whatsappNumber', e.target.value)} placeholder="0712 345 678" />}</Field>}
                  </div>
                  <Switch label="Email" description={`Buyers can email ${user.dealer ? 'your dealership' : user.email}.`} checked={values.contact.email} onChange={(v) => setContact('email', v)} />
                </div>
              )}

              {current.id === 'preview' && (
                <div className="space-y-8">
                  <Alert tone="info">This is exactly how buyers will see your listing. Go back to any step to make changes.</Alert>
                  <div className="grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)]">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-muted">In search results</p>
                      <div className="pointer-events-none"><VehicleCard vehicle={card} /></div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-muted">On the listing page</p>
                      <Gallery images={values.images} title={card.title} />
                      <h3 className="mt-5 text-2xl font-extrabold">{card.title}</h3>
                      <p className="mt-1 font-display text-2xl font-extrabold text-brand-700">{formatKES(card.price)} {values.negotiable && <Badge tone="teal">Negotiable</Badge>}</p>
                      <p className="mt-2 text-sm text-slate-600">{formatMileage(card.mileageKm)} · {formatEngine(card.engineCc)} · {card.fuel} · {card.transmission} · {card.conditionLabel} · {values.town}</p>
                      <p className="mt-4 text-[15px] leading-7 whitespace-pre-line text-slate-700">{values.description}</p>
                      <div className="mt-4 flex flex-wrap gap-1.5">{tax.features.filter((f) => values.features.includes(f.slug)).map((f) => <Badge key={f.slug} tone="neutral" icon={Check}>{f.name}</Badge>)}</div>
                    </div>
                  </div>
                </div>
              )}

              {current.id === 'publish' && (
                <div className="space-y-6">
                  {user.dealer ? (
                    <Alert tone="info" title={`${user.dealer.name} — ${quota?.packageName || 'Dealer plan'}`}>
                      {quota ? `${quota.used} of ${quota.allowance} active listing slots used.` : 'Checking your listing allowance…'} {user.dealer.verified ? 'Listings from verified dealers go live immediately.' : 'Your listing will be reviewed before it goes live.'}
                    </Alert>
                  ) : (
                    <fieldset>
                      <legend className="mb-3 font-semibold">Choose a listing package</legend>
                      <div className="grid gap-3 md:grid-cols-3">
                        {listingPackages.map((p) => {
                          const sel = selectedPkg?.id === p.id
                          return (
                            <label key={p.id} className={cn('relative flex cursor-pointer flex-col rounded-xl border p-4 has-focus-visible:ring-2 has-focus-visible:ring-teal-600', sel ? 'border-teal-600 ring-1 ring-teal-600' : 'border-line hover:border-slate-300')}>
                              <input type="radio" name="package" className="sr-only" checked={sel} onChange={() => setPackageId(p.id)} />
                              {p.featured && <Badge tone="accent" icon={Sparkles} className="absolute -top-2.5 right-3">Most exposure</Badge>}
                              <span className="font-semibold">{p.name}</span>
                              <span className="mt-1 font-display text-2xl font-extrabold">{p.price ? formatKES(p.price) : 'Free'}</span>
                              <span className="mt-2 text-sm text-muted">{p.description}</span>
                              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                                <li className="flex gap-1.5"><Check className="size-3.5 text-success" />{p.durationDays} days live</li>
                                {p.boostDays > 0 && <li className="flex gap-1.5"><Check className="size-3.5 text-success" />{p.boostDays}-day search boost</li>}
                                {p.featured && <li className="flex gap-1.5"><Check className="size-3.5 text-success" />Homepage feature</li>}
                                {p.analytics && <li className="flex gap-1.5"><Check className="size-3.5 text-success" />Performance analytics</li>}
                              </ul>
                            </label>
                          )
                        })}
                      </div>
                      {quota && selectedPkg?.price === 0 && quota.used >= quota.allowance && (
                        <Alert tone="warning" className="mt-4" title="Free listing limit reached">You have {quota.used} active free listings (limit {quota.allowance}). Choose a paid package, or pause another listing first.</Alert>
                      )}
                    </fieldset>
                  )}
                  {submit.error && !submit.error.fieldErrors && <Alert tone="danger" title="Couldn’t publish">{submit.error.message}</Alert>}
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />By publishing, you confirm the information is accurate and you have the right to sell this vehicle. Listings are reviewed under our <Link to="/terms" className="font-medium text-teal-700 underline">terms</Link>.</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => goTo(step - 1)} disabled={step === 0}>Back</Button>
            {current.id === 'publish' ? (
              <Button variant="accent" size="lg" icon={BadgeCheck} loading={saveDraft.isPending || submit.isPending} onClick={publish}>
                {selectedPkg?.price > 0 && !user.dealer ? `Pay ${formatKES(selectedPkg.price)} & publish` : initialId ? 'Save & submit' : 'Publish listing'}
              </Button>
            ) : (
              <Button iconRight={ArrowRight} onClick={next}>Continue</Button>
            )}
          </div>
        </div>
      </div>

      {paying && (
        <PaymentDialog
          open
          onClose={() => setPaying(null)}
          packages={[selectedPkg]}
          defaultPackageId={selectedPkg.id}
          vehicle={{ id: paying.id, title: card.title }}
          onPaid={() => {
            const id = paying.id
            setTimeout(() => {
              setPaying(null)
              submit.mutate(id)
            }, 1200)
          }}
        />
      )}
    </div>
  )
}

export default function SellVehiclePage() {
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const { user } = useAuth()
  const { data: tax, isLoading: taxLoading, error: taxError } = useTaxonomy()
  const existing = useQuery({ queryKey: ['vehicle', editId], queryFn: () => api.vehicles.get(editId), enabled: !!editId })
  const initial = useMemo(() => {
    if (editId) return existing.data ? fromVehicle(existing.data.vehicle) : null
    return emptyValues(user)
  }, [editId, existing.data, user])

  return (
    <div className="container-page py-8">
      <Seo title={editId ? 'Edit listing' : 'List your car'} noindex />
      {taxError || existing.error ? (
        <ErrorState error={taxError || existing.error} />
      ) : taxLoading || !initial ? (
        editId ? <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 rounded-xl" /></div> : <FullPageSpinner />
      ) : existing.data && !existing.data.canManage ? (
        <ErrorState error={{ status: 403, message: 'You can only edit your own listings.' }} />
      ) : (
        <Wizard key={editId || 'new'} initial={initial} vehicleId={editId} user={user} tax={tax} existingStatus={existing.data?.vehicle?.status} />
      )}
    </div>
  )
}

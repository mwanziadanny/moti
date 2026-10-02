import { CONDITIONS, IMPORT_STATUSES } from '../../lib/constants'
import { slugify } from '../../lib/format'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
/** Random short id; pass a seeded `rand` (0..1) for deterministic demo data. */
export function shortId(len = 8, rand) {
  if (rand) return Array.from({ length: len }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('')
  const bytes = new Uint8Array(len)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function vehicleTitle(v, brand, model) {
  return [v.year, brand?.name, model?.name, v.variant].filter(Boolean).join(' ')
}

export function buildVehicleSlug(v, brand, model, rand) {
  return `${slugify(vehicleTitle(v, brand, model))}-${shortId(8, rand)}`
}

/**
 * Indicative running-cost estimates. Clearly labelled in the UI as estimates —
 * derived from engine size, fuel and body type, NOT manufacturer data.
 */
export function computeEstimates(v, bodySlug, fuelSlug) {
  if (fuelSlug === 'electric') {
    return { method: 'heuristic', fuelTownKml: null, fuelHighwayKml: null, fuelCombinedKml: null, insuranceAnnual: Math.max(37_500, Math.round((v.price * 0.04) / 500) * 500) }
  }
  let l100 = 3.0 + (v.engineCc / 1000) * 2.4
  if (fuelSlug === 'diesel') l100 *= 0.85
  if (fuelSlug === 'hybrid') l100 *= 0.58
  if (['suv', 'pickup-truck', 'van-bus'].includes(bodySlug)) l100 *= 1.15
  if (bodySlug === 'sports-car') l100 *= 1.12
  if (v.driveType === '4WD') l100 *= 1.06
  const kml = (x) => Math.round((100 / x) * 10) / 10
  return {
    method: 'heuristic',
    fuelTownKml: kml(l100 * 1.28),
    fuelHighwayKml: kml(l100 * 0.82),
    fuelCombinedKml: kml(l100),
    insuranceAnnual: Math.max(37_500, Math.round((v.price * 0.04) / 500) * 500),
  }
}

export function lookups(db) {
  const map = (rows) => new Map(rows.map((r) => [r.id, r]))
  return {
    brands: map(db.brands),
    models: map(db.models),
    bodyTypes: map(db.bodyTypes),
    fuelTypes: map(db.fuelTypes),
    transmissions: map(db.transmissions),
    dealers: map(db.dealers),
    users: map(db.users),
  }
}

const isActive = (iso) => !!iso && new Date(iso).getTime() > Date.now()

function sellerSummary(v, L) {
  const dealer = v.dealerId ? L.dealers.get(v.dealerId) : null
  if (dealer) {
    return { type: 'DEALER', name: dealer.name, slug: dealer.slug, logoUrl: dealer.logoUrl, verified: dealer.verified, location: dealer.town }
  }
  const user = L.users.get(v.sellerId)
  return {
    type: v.sellerType === 'AGENT' ? 'AGENT' : 'PRIVATE',
    name: user ? user.name.split(' ')[0] : 'Private seller',
    slug: null,
    logoUrl: null,
    verified: !!user?.verified,
    location: v.town,
    memberSince: user?.createdAt,
  }
}

/** Lightweight shape for cards and lists. */
export function toCard(v, L) {
  const brand = L.brands.get(v.brandId)
  const model = L.models.get(v.modelId)
  return {
    id: v.id,
    ref: v.ref,
    slug: v.slug,
    title: vehicleTitle(v, brand, model),
    year: v.year,
    make: brand?.name,
    makeSlug: brand?.slug,
    model: model?.name,
    modelSlug: model?.slug,
    variant: v.variant,
    bodyType: L.bodyTypes.get(v.bodyTypeId)?.name,
    bodySlug: L.bodyTypes.get(v.bodyTypeId)?.slug,
    mileageKm: v.mileageKm,
    engineCc: v.engineCc,
    fuel: L.fuelTypes.get(v.fuelTypeId)?.name,
    transmission: L.transmissions.get(v.transmissionId)?.name,
    condition: v.condition,
    conditionLabel: CONDITIONS.find((c) => c.value === v.condition)?.label,
    importStatus: v.importStatus,
    importLabel: IMPORT_STATUSES.find((c) => c.value === v.importStatus)?.label,
    price: v.price,
    negotiable: v.negotiable,
    image: v.images[0] || null,
    imageCount: v.images.length,
    town: v.town,
    county: v.county,
    status: v.status,
    featured: isActive(v.featuredUntil),
    boosted: isActive(v.boostedUntil),
    seller: sellerSummary(v, L),
    publishedAt: v.publishedAt,
    updatedAt: v.updatedAt,
    createdAt: v.createdAt,
    views: v.views,
  }
}

/** Full public shape. Contact details are only included for channels the seller enabled. */
export function toDetail(v, db, L) {
  const card = toCard(v, L)
  const features = db.features.filter((f) => v.features.includes(f.slug)).map(({ slug, name, group }) => ({ slug, name, group }))
  const c = v.contact || {}
  const dealer = v.dealerId ? L.dealers.get(v.dealerId) : null
  const seller = L.users.get(v.sellerId)
  return {
    ...card,
    brandId: v.brandId,
    modelId: v.modelId,
    bodyTypeId: v.bodyTypeId,
    fuelTypeId: v.fuelTypeId,
    transmissionId: v.transmissionId,
    driveType: v.driveType,
    powerHp: v.powerHp,
    seats: v.seats,
    airbags: v.airbags,
    interiorMaterial: v.interiorMaterial,
    colour: v.colour,
    features,
    images: v.images,
    description: v.description,
    area: v.area,
    soldAt: v.soldAt,
    estimates: v.estimates,
    contact: {
      inApp: !!c.inApp,
      phone: c.phone ? c.phoneNumber : null,
      whatsapp: c.whatsapp ? c.whatsappNumber : null,
      email: c.email ? (dealer?.email || seller?.email) : null,
    },
    dealer: dealer
      ? { id: dealer.id, slug: dealer.slug, name: dealer.name, logoUrl: dealer.logoUrl, verified: dealer.verified, town: dealer.town, address: dealer.address, openingHours: dealer.openingHours, since: dealer.since }
      : null,
    sellerId: v.sellerId,
  }
}

/** Owner/admin shape: everything, including moderation history and raw contact prefs. */
export function toOwnerView(v, db, L) {
  return {
    ...toDetail(v, db, L),
    sellerType: v.sellerType,
    authorityDocUrl: v.authorityDocUrl,
    rawFeatures: v.features,
    contactPrefs: v.contact,
    moderation: v.moderation,
    changesRequested: v.changesRequested,
    hiddenByAdmin: v.hiddenByAdmin,
    featuredUntil: v.featuredUntil,
    boostedUntil: v.boostedUntil,
    expiresAt: v.expiresAt,
    favouritesCount: v.favouritesCount,
    packageId: v.packageId,
    sellerName: L.users.get(v.sellerId)?.name,
    sellerEmail: L.users.get(v.sellerId)?.email,
  }
}

// ---- search -------------------------------------------------------------------------

export function levenshtein(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]
}

export const tokenize = (s = '') =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s]+/).flatMap((t) => (t.includes('-') ? [t, ...t.split('-'), t.replace(/-/g, '')] : [t])).filter(Boolean)

/** Builds the token set a vehicle can be matched by (make, model, aliases, body, seller, ref…). */
export function searchTokens(v, L) {
  const brand = L.brands.get(v.brandId)
  const model = L.models.get(v.modelId)
  const dealer = v.dealerId ? L.dealers.get(v.dealerId) : null
  const parts = [
    String(v.year), brand?.name, ...(brand?.aliases || []), model?.name, (model?.name || '').replace(/\s+/g, ''), v.variant,
    L.bodyTypes.get(v.bodyTypeId)?.name, L.fuelTypes.get(v.fuelTypeId)?.name, L.transmissions.get(v.transmissionId)?.name,
    v.colour, v.town, v.county, dealer?.name, v.ref, v.driveType,
  ]
  return new Set(tokenize(parts.filter(Boolean).join(' ')))
}

/** Scores a tokenised query against a vehicle token set: exact > prefix > fuzzy. 0 = no match. */
export function scoreQuery(queryTokens, tokens) {
  let score = 0
  for (const q of queryTokens) {
    if (tokens.has(q)) {
      score += 3
      continue
    }
    let best = 0
    for (const t of tokens) {
      if (q.length >= 2 && t.startsWith(q)) best = Math.max(best, 2)
      else if (q.length >= 4 && levenshtein(q, t) <= (q.length >= 7 ? 2 : 1)) best = Math.max(best, 1)
      if (best === 2) break
    }
    if (!best) return 0
    score += best
  }
  return score
}

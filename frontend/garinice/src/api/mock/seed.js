import { COLOURS } from '../../lib/constants'
import { slugify } from '../../lib/format'
import { hashPassword } from './crypto'
import { emptyDb, uid } from './db'
import {
  BODY_TYPES, BRANDS, CMS_PAGES, DEALERS, DESCRIPTIONS, FEATURES, FUEL_TYPES, LOCATIONS, PACKAGES,
  PRIVATE_SELLERS, TRANSMISSIONS,
} from './seedData'
import { buildVehicleSlug, computeEstimates } from './vehicleUtils'

export const DEMO_PASSWORD = 'Password123!'

function mulberry32(seed) {
  return function rand() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dealerLogo(name, colour) {
  const letters = name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0])).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="${colour}"/><path d="M20 84h80" stroke="#fff" stroke-opacity=".25" stroke-width="4"/><text x="60" y="72" text-anchor="middle" font-family="Plus Jakarta Sans,Arial,sans-serif" font-weight="800" font-size="44" fill="#fff">${letters}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function createSeed({ vehicleCount = 220, seed = 20261002 } = {}) {
  const rand = mulberry32(seed)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const between = (a, b) => a + rand() * (b - a)
  const intBetween = (a, b) => Math.floor(between(a, b + 1))
  const NOW = Date.now()
  const DAY = 86_400_000
  const daysAgo = (d) => new Date(NOW - d * DAY).toISOString()
  const db = emptyDb()

  // ---- taxonomy -------------------------------------------------------------------
  db.bodyTypes = BODY_TYPES.map((b, i) => ({ id: uid(), ...b, sort: i }))
  db.fuelTypes = FUEL_TYPES.map((f, i) => ({ id: uid(), ...f, sort: i }))
  db.transmissions = TRANSMISSIONS.map((t, i) => ({ id: uid(), ...t, sort: i }))
  db.locations = LOCATIONS.map((l, i) => ({ id: uid(), ...l, sort: i }))
  db.features = FEATURES.map(([slug, name, group], i) => ({ id: uid(), slug, name, group, sort: i }))
  const body = Object.fromEntries(db.bodyTypes.map((b) => [b.slug, b]))
  const fuel = Object.fromEntries(db.fuelTypes.map((f) => [f.slug, f]))
  const trans = Object.fromEntries(db.transmissions.map((t) => [t.slug, t]))
  const loc = Object.fromEntries(db.locations.map((l) => [l.slug, l]))

  const modelSpecs = []
  BRANDS.forEach((b, i) => {
    const brand = { id: uid(), name: b.name, slug: slugify(b.name), popular: b.popular, active: true, aliases: b.aliases || [], country: b.country, sort: i, createdAt: daysAgo(400) }
    db.brands.push(brand)
    b.models.forEach(([name, bodySlug, engines, fuels, price, years, drive, seats, variants], j) => {
      const model = { id: uid(), brandId: brand.id, name, slug: slugify(name), bodyTypeId: body[bodySlug].id, active: true, sort: j, createdAt: daysAgo(400) }
      db.models.push(model)
      modelSpecs.push({ brand, model, bodySlug, engines, fuels, price, years, drive, seats, variants, weight: b.weight / b.models.length })
    })
  })

  // ---- users ----------------------------------------------------------------------
  const pw = await hashPassword(DEMO_PASSWORD)
  const mkUser = (name, email, role, extra = {}) => {
    const u = {
      id: uid(), name, email, role, passwordHash: pw, phone: extra.phone || `+2547${intBetween(10, 99)}${intBetween(100000, 999999)}`,
      emailVerified: true, phoneVerified: !!extra.phoneVerified, verified: !!extra.verified, suspended: false,
      createdAt: extra.createdAt || daysAgo(intBetween(20, 380)), lastLoginAt: daysAgo(intBetween(0, 10)), deletedAt: null,
    }
    db.users.push(u)
    db.profiles.push({ id: uid(), userId: u.id, location: extra.location || 'Nairobi', bio: '', avatarUrl: null, notifyEmail: true, notifySms: false, notifyWhatsapp: false })
    return u
  }
  const superAdmin = mkUser('Amani Kariuki', 'admin@garinice.co.ke', 'SUPER_ADMIN', { createdAt: daysAgo(420), verified: true })
  mkUser('Brian Mwangi', 'moderator@garinice.co.ke', 'ADMIN', { createdAt: daysAgo(300), verified: true })
  const buyer = mkUser('Faith Achieng', 'buyer@example.com', 'BUYER', { createdAt: daysAgo(30) })
  for (let i = 0; i < 46; i++) {
    const first = pick(['Kevin', 'Mercy', 'Dennis', 'Joy', 'Collins', 'Ann', 'Victor', 'Esther', 'Moses', 'Lucy', 'Ian', 'Diana'])
    const last = pick(['Wafula', 'Njoroge', 'Omondi', 'Mutiso', 'Chebet', 'Barasa', 'Karanja', 'Atieno', 'Kibet', 'Muthoni'])
    mkUser(`${first} ${last}`, `${first}.${last}${i}@example.com`.toLowerCase(), 'BUYER', { createdAt: daysAgo(intBetween(0, 180)) })
  }

  const privateSellers = PRIVATE_SELLERS.map(([name, email, town], i) =>
    mkUser(name, email, 'PRIVATE_SELLER', { location: loc[town].name, verified: i < 2, phoneVerified: true }),
  )
  privateSellers.forEach((u, i) => (u.town = PRIVATE_SELLERS[i][2]))

  // ---- dealers ----------------------------------------------------------------------
  for (const d of DEALERS) {
    const slug = slugify(d.name)
    const domain = slug.replace(/-/g, '')
    const owner = mkUser(`${d.name} Admin`, `owner@${domain}.co.ke`, 'DEALER', { location: loc[d.town].name, verified: d.verified, phoneVerified: true, createdAt: daysAgo(intBetween(200, 400)) })
    const dealer = {
      id: uid(), slug, name: d.name, ownerId: owner.id, tagline: d.tagline,
      description: `${d.name} has been serving car buyers in ${loc[d.town].name} since ${d.since}. We stock a carefully selected range of vehicles, and every car on our yard is inspected before sale. Visit our showroom on ${d.area} or message us on GariNice to book a viewing. Trade-ins and financing via partner banks are available.`,
      phone: owner.phone, whatsapp: owner.phone, email: owner.email, website: `https://${domain}.co.ke`,
      county: loc[d.town].county, town: loc[d.town].name, locationSlug: d.town, address: `${d.area}, ${loc[d.town].name}`,
      openingHours: 'Mon–Fri 8:00–18:00 · Sat 9:00–16:00', logoUrl: dealerLogo(d.name, d.colour), brandColour: d.colour,
      coverUrl: null, verified: d.verified, verifiedAt: d.verified ? daysAgo(intBetween(30, 300)) : null,
      suspended: false, since: d.since, createdAt: owner.createdAt, deletedAt: null,
    }
    db.dealers.push(dealer)
    db.dealerStaff.push({ id: uid(), dealerId: dealer.id, userId: owner.id, role: 'OWNER', createdAt: owner.createdAt })
    if (slug === 'axis-motors') {
      const staff = mkUser('Joseph Njuguna', 'staff@axismotors.co.ke', 'DEALER_STAFF', { location: 'Nairobi' })
      db.dealerStaff.push({ id: uid(), dealerId: dealer.id, userId: staff.id, role: 'STAFF', createdAt: daysAgo(90) })
    }
  }

  // ---- packages ---------------------------------------------------------------------
  db.packages = PACKAGES.map((p) => ({ id: uid(), ...p, active: true, createdAt: daysAgo(400) }))
  const dealerPro = db.packages.find((p) => p.name === 'Dealer Pro')
  const dealerStarter = db.packages.find((p) => p.name === 'Dealer Starter')
  const featuredPkg = db.packages.find((p) => p.name === 'Featured Listing')
  const premiumPkg = db.packages.find((p) => p.name === 'Premium Listing')

  // ---- vehicles -----------------------------------------------------------------------
  const totalWeight = modelSpecs.reduce((s, m) => s + m.weight, 0)
  const pickSpec = () => {
    let r = rand() * totalWeight
    for (const m of modelSpecs) {
      r -= m.weight
      if (r <= 0) return m
    }
    return modelSpecs[0]
  }
  const featureSlugs = db.features.map((f) => f.slug)
  const currentYear = new Date().getFullYear()

  const makeVehicle = (spec, overrides = {}) => {
    const { brand, model, bodySlug, engines, fuels, price, years, drive, seats, variants } = spec
    const maxYear = Math.min(years[1], currentYear)
    const year = overrides.year ?? Math.max(years[0], maxYear - Math.floor(Math.pow(rand(), 1.4) * (maxYear - years[0] + 1)))
    const age = currentYear - year
    let condition = overrides.condition
    if (!condition) {
      const r = rand()
      condition = age <= 1 && r < 0.35 ? 'BRAND_NEW' : r < 0.55 ? 'FOREIGN_USED' : 'KENYAN_USED'
    }
    const importStatus = overrides.importStatus ?? (condition === 'KENYAN_USED' ? 'LOCAL' : rand() < 0.22 ? 'DIRECT_IMPORT' : rand() < 0.1 ? 'IN_TRANSIT' : 'LOCAL')
    const fuelSlug = overrides.fuel ?? pick(fuels)
    const engineCc = overrides.engineCc ?? pick(engines)
    const mileageKm = overrides.mileageKm ?? (condition === 'BRAND_NEW' ? intBetween(5, 60)
      : Math.round((Math.max(age, 1) * (condition === 'KENYAN_USED' ? between(11_000, 21_000) : between(6_000, 12_000))) / 100) * 100)
    const depreciation = Math.pow(0.9, age) * (condition === 'KENYAN_USED' ? 0.88 : 1) * (condition === 'BRAND_NEW' ? 1.12 : 1)
    const base = between(price[0], price[1])
    const finalPrice = overrides.price ?? Math.max(450_000, Math.round((base * depreciation) / 50_000) * 50_000)

    const isDealer = overrides.dealerId !== undefined ? !!overrides.dealerId : rand() < 0.68
    const dealer = isDealer ? (overrides.dealerId ? db.dealers.find((d) => d.id === overrides.dealerId) : pick(db.dealers)) : null
    const seller = dealer ? db.users.find((u) => u.id === dealer.ownerId) : overrides.seller ?? pick(privateSellers)
    const town = dealer ? loc[dealer.locationSlug] : loc[seller.town] || pick(db.locations)

    const colour = overrides.colour ?? pick(COLOURS)
    const nImages = intBetween(4, 6)
    const hex = colour.hex.slice(1)
    const offset = intBetween(0, 5)
    const images = Array.from({ length: nImages }, (_, k) => ({
      id: uid(), url: `demo:${bodySlug}/${hex}/${(k + offset) % 6}`, thumb: null,
      alt: '', width: 800, height: 600,
    }))

    const nFeatures = intBetween(6, 18)
    const features = [...new Set(Array.from({ length: nFeatures }, () => pick(featureSlugs)))]
    if (!features.includes('abs')) features.push('abs')
    if (!features.includes('air-conditioning')) features.push('air-conditioning')

    const createdDays = overrides.createdDays ?? Math.floor(Math.pow(rand(), 1.6) * 110)
    const createdAt = daysAgo(createdDays + rand())
    const variant = overrides.variant ?? (rand() < 0.75 ? pick(variants) : '')
    const transmission = overrides.transmission ?? (rand() < (bodySlug === 'pickup-truck' ? 0.4 : 0.1) ? 'manual' : 'automatic')

    const v = {
      id: uid(), ref: null, slug: null,
      sellerId: seller.id, dealerId: dealer?.id || null,
      sellerType: dealer ? 'DEALER' : 'PRIVATE', authorityDocUrl: null,
      brandId: brand.id, modelId: model.id, variant, year, bodyTypeId: body[bodySlug].id,
      condition, importStatus, engineCc, fuelTypeId: fuel[fuelSlug].id, transmissionId: trans[transmission].id,
      driveType: drive, powerHp: Math.round(engineCc / 1000 * between(60, 85)), mileageKm,
      seats, airbags: intBetween(2, 8), interiorMaterial: pick(['Fabric', 'Leather', 'Part leather']), colour: colour.name,
      features, price: finalPrice, negotiable: rand() < 0.55, currency: 'KES',
      county: town.county, town: town.name, area: dealer ? dealer.address.split(',')[0] : '', locationSlug: town.slug,
      images,
      description: `${year} ${brand.name} ${model.name}${variant ? ` ${variant}` : ''} in ${colour.name.toLowerCase()}. ${pick(DESCRIPTIONS)} ${pick(DESCRIPTIONS)}\n\nViewing available in ${town.name}. ${dealer ? 'Trade-ins welcome and financing available through partner banks.' : 'Genuine buyers only, please.'}`,
      contact: dealer
        ? { inApp: true, phone: true, whatsapp: true, email: true, phoneNumber: dealer.phone, whatsappNumber: dealer.whatsapp }
        : { inApp: true, phone: rand() < 0.6, whatsapp: rand() < 0.5, email: false, phoneNumber: seller.phone, whatsappNumber: seller.phone },
      status: 'PUBLISHED', hiddenByAdmin: false, changesRequested: null,
      featuredUntil: null, boostedUntil: null, packageId: null,
      views: Math.round(between(20, 900) * Math.max(0.2, 1 - createdDays / 140)), favouritesCount: intBetween(0, 40),
      createdAt, updatedAt: createdAt, publishedAt: createdAt,
      expiresAt: new Date(new Date(createdAt).getTime() + 60 * DAY).toISOString(),
      soldAt: null, deletedAt: null, moderation: [],
      ...overrides.extra,
    }
    if (v.expiresAt < new Date(NOW + DAY).toISOString()) v.expiresAt = new Date(NOW + intBetween(3, 40) * DAY).toISOString()
    v.slug = buildVehicleSlug(v, brand, model, rand)
    v.ref = v.slug.split('-').pop().toUpperCase()
    v.estimates = computeEstimates(v, bodySlug, fuelSlug)
    v.moderation.push({ id: uid(), action: 'APPROVED', status: 'PUBLISHED', byId: superAdmin.id, note: null, at: createdAt })
    db.vehicles.push(v)
    return v
  }

  const specBy = (brandName, modelName) => modelSpecs.find((m) => m.brand.name === brandName && m.model.name === modelName)
  // Hand-crafted showcase vehicles.
  makeVehicle(specBy('Toyota', 'Axio'), { year: 2019, variant: 'Hybrid', fuel: 'hybrid', engineCc: 1500, mileageKm: 193_700, condition: 'KENYAN_USED', importStatus: 'LOCAL', price: 1_750_000, transmission: 'automatic', createdDays: 1, dealerId: null, seller: privateSellers[0], extra: { negotiable: true } })
  makeVehicle(specBy('Toyota', 'Hilux'), { year: 2021, variant: 'Double Cab', fuel: 'diesel', engineCc: 2400, mileageKm: 45_000, condition: 'FOREIGN_USED', importStatus: 'LOCAL', price: 5_750_000, transmission: 'automatic', createdDays: 0, dealerId: null, seller: privateSellers[2] })
  for (let i = 0; i < 6; i++) makeVehicle(specBy('Toyota', 'Land Cruiser Prado'), { createdDays: intBetween(0, 40) })
  for (let i = 0; i < vehicleCount - 8; i++) makeVehicle(pickSpec())

  // Status mix
  const vs = db.vehicles
  const setStatus = (v, status, extra = {}) => Object.assign(v, { status, ...extra })
  vs.slice(8).forEach((v, i) => {
    if (i % 14 === 3) setStatus(v, 'SOLD', { soldAt: daysAgo(intBetween(1, 20)) })
    else if (i % 37 === 5) setStatus(v, 'PENDING_REVIEW', { publishedAt: null, moderation: [], createdAt: daysAgo(rand() * 2), updatedAt: daysAgo(rand()) })
    else if (i % 53 === 7) setStatus(v, 'PAUSED')
    else if (i % 71 === 9) setStatus(v, 'DRAFT', { publishedAt: null, moderation: [] })
    else if (i % 89 === 11) setStatus(v, 'REJECTED', { publishedAt: null, moderation: [{ id: uid(), action: 'REJECTED', status: 'REJECTED', byId: superAdmin.id, note: 'Photos appear to be stock images. Please upload real photos of the vehicle.', at: daysAgo(2) }] })
    else if (i % 97 === 13) setStatus(v, 'EXPIRED', { expiresAt: daysAgo(3) })
  })
  // Make sure each private seller has listings in a variety of states
  const pend = vs.filter((v) => v.status === 'PENDING_REVIEW')
  if (pend[0]) Object.assign(pend[0], { sellerId: privateSellers[0].id, dealerId: null, sellerType: 'PRIVATE' })

  // Featured / boosted
  vs.filter((v) => v.status === 'PUBLISHED').sort(() => rand() - 0.5).slice(0, 12).forEach((v, i) => {
    if (i < 8) {
      v.featuredUntil = new Date(NOW + intBetween(2, 14) * DAY).toISOString()
      v.packageId = featuredPkg.id
    } else v.packageId = premiumPkg.id
    v.boostedUntil = new Date(NOW + intBetween(1, 7) * DAY).toISOString()
  })

  // ---- favourites, conversations ---------------------------------------------------
  const published = vs.filter((v) => v.status === 'PUBLISHED')
  published.slice(0, 4).forEach((v) => db.favourites.push({ id: uid(), userId: buyer.id, vehicleId: v.id, createdAt: daysAgo(intBetween(0, 10)) }))

  const convoSeeds = [
    [published[2], ['Hi, is this vehicle still available?', 'Yes it is. When would you like to view it?', 'Can I come on Saturday morning?']],
    [vs[0], ['Hello, is the price negotiable?', 'Slightly negotiable after viewing. Where are you based?']],
  ]
  for (const [vehicle, lines] of convoSeeds) {
    if (!vehicle) continue
    const start = NOW - intBetween(1, 4) * DAY
    const c = { id: uid(), vehicleId: vehicle.id, buyerId: buyer.id, sellerId: vehicle.sellerId, dealerId: vehicle.dealerId, createdAt: new Date(start).toISOString(), buyerLastReadAt: null, sellerLastReadAt: null }
    lines.forEach((body, k) => {
      const at = new Date(start + k * 3_600_000).toISOString()
      db.messages.push({ id: uid(), conversationId: c.id, senderId: k % 2 === 0 ? buyer.id : vehicle.sellerId, body, createdAt: at, deletedAt: null })
      c.lastMessageAt = at
      c.lastMessagePreview = body
    })
    c.buyerLastReadAt = c.lastMessageAt
    db.conversations.push(c)
  }

  // ---- payments & purchases ------------------------------------------------------------
  const mkPayment = (user, pkg, status, days, vehicleId = null) => {
    const createdAt = daysAgo(days)
    const p = {
      id: uid(), reference: `GNP${Math.floor(between(100000, 999999))}`, userId: user.id, amount: pkg.price, currency: 'KES',
      purpose: 'PACKAGE', packageId: pkg.id, vehicleId, status, gateway: 'MPESA', method: 'MPESA',
      phone: user.phone, gatewayRef: `ws_CO_${Math.floor(between(1e9, 9e9))}`, receipt: status === 'SUCCESS' ? `S${Math.random().toString(36).slice(2, 11).toUpperCase()}` : null,
      idempotencyKey: uid(), failureReason: status === 'FAILED' ? 'The user cancelled the request or insufficient funds.' : null,
      createdAt, updatedAt: createdAt, completedAt: status === 'SUCCESS' ? createdAt : null,
    }
    db.payments.push(p)
    return p
  }
  db.dealers.forEach((d, i) => {
    const owner = db.users.find((u) => u.id === d.ownerId)
    const pkg = i < 4 ? dealerPro : dealerStarter
    for (let m = 3; m >= 0; m--) {
      const pay = mkPayment(owner, pkg, 'SUCCESS', m * 30 + intBetween(0, 5))
      if (m === 0) {
        db.purchases.push({ id: uid(), userId: owner.id, dealerId: d.id, packageId: pkg.id, paymentId: pay.id, vehicleId: null, startsAt: pay.createdAt, endsAt: new Date(new Date(pay.createdAt).getTime() + pkg.durationDays * DAY).toISOString(), createdAt: pay.createdAt })
      }
    }
  })
  vs.filter((v) => v.packageId && v.sellerType === 'PRIVATE').forEach((v) => {
    const seller = db.users.find((u) => u.id === v.sellerId)
    const pkg = db.packages.find((p) => p.id === v.packageId)
    const pay = mkPayment(seller, pkg, 'SUCCESS', intBetween(0, 10), v.id)
    db.purchases.push({ id: uid(), userId: seller.id, dealerId: null, packageId: pkg.id, paymentId: pay.id, vehicleId: v.id, startsAt: pay.createdAt, endsAt: v.expiresAt, createdAt: pay.createdAt })
  })
  mkPayment(privateSellers[0], premiumPkg, 'FAILED', 6, vs[0].id)

  // ---- reports -------------------------------------------------------------------------
  const reasons = ['FRAUD', 'WRONG_PRICE', 'ALREADY_SOLD', 'DUPLICATE']
  published.slice(10, 14).forEach((v, i) => {
    db.reports.push({ id: uid(), vehicleId: v.id, reporterId: i % 2 ? buyer.id : null, reporterEmail: i % 2 ? null : 'concerned@example.com', reason: reasons[i], details: ['Seller asked for a deposit before viewing.', 'Price seems far below market — possibly a scam.', 'This car was sold last week.', 'Same car listed twice with different prices.'][i], status: 'OPEN', resolution: null, createdAt: daysAgo(i), resolvedAt: null, resolvedById: null })
  })

  // ---- notifications -----------------------------------------------------------------
  db.notifications.push(
    { id: uid(), userId: privateSellers[0].id, type: 'NEW_MESSAGE', title: 'New message from Faith', body: 'Hello, is the price negotiable?', link: '/dashboard/messages', readAt: null, createdAt: daysAgo(1) },
    { id: uid(), userId: privateSellers[0].id, type: 'LISTING_APPROVED', title: 'Your listing is live', body: '2019 Toyota Axio Hybrid has been approved and is now visible to buyers.', link: '/dashboard/listings', readAt: null, createdAt: daysAgo(1) },
    { id: uid(), userId: buyer.id, type: 'NEW_MESSAGE', title: 'Seller replied', body: 'Yes it is. When would you like to view it?', link: '/messages', readAt: null, createdAt: daysAgo(2) },
  )

  // ---- analytics (daily rollups) -------------------------------------------------------
  for (const v of vs.filter((x) => x.publishedAt)) {
    const age = Math.max(1, Math.floor((NOW - new Date(v.createdAt).getTime()) / DAY))
    const days = Math.min(age, 60)
    let remaining = v.views
    for (let d = 0; d < days && remaining > 0; d += intBetween(1, 4)) {
      const n = Math.min(remaining, intBetween(1, Math.ceil(v.views / Math.max(4, days / 2))))
      remaining -= n
      db.analyticsEvents.push({ id: uid(), type: 'VEHICLE_VIEW', vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId, userId: null, count: n, meta: null, createdAt: daysAgo(d + rand()) })
    }
    const contacts = Math.floor(v.views / 40)
    for (let k = 0; k < contacts; k++) {
      db.analyticsEvents.push({ id: uid(), type: pick(['PHONE_CLICK', 'WHATSAPP_CLICK', 'MESSAGE', 'FAVOURITE', 'SHARE']), vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId, userId: null, count: 1, meta: null, createdAt: daysAgo(intBetween(0, days)) })
    }
    db.analyticsEvents.push({ id: uid(), type: 'LISTING_PUBLISHED', vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId, userId: v.sellerId, count: 1, meta: null, createdAt: v.publishedAt })
  }
  for (let i = 0; i < 900; i++) {
    const spec = pickSpec()
    const r = rand()
    db.analyticsEvents.push({
      id: uid(), type: 'SEARCH', vehicleId: null, dealerId: null, sellerId: null, userId: null, count: 1,
      meta: { make: spec.brand.slug, model: r < 0.6 ? spec.model.slug : null, body: r > 0.4 ? spec.bodySlug : null, maxPrice: pick([1_000_000, 2_000_000, 5_000_000, null]) },
      createdAt: daysAgo(Math.floor(Math.pow(rand(), 1.3) * 60)),
    })
  }

  // ---- CMS, SEO, promotions, settings ------------------------------------------------
  db.cmsPages = Object.entries(CMS_PAGES).map(([slug, p]) => ({ id: uid(), slug, title: p.title, body: p.body, published: true, updatedAt: daysAgo(20), createdAt: daysAgo(300) }))
  db.seoRecords = [
    { id: uid(), path: '/cars/toyota', title: 'Toyota cars for sale in Kenya | GariNice', description: 'Browse new and used Toyota cars for sale in Kenya — Prado, Harrier, Axio, Fielder, Hilux and more from verified dealers and private sellers.', intro: '', noindex: false, updatedAt: daysAgo(10) },
    { id: uid(), path: '/cars/body/suv', title: 'SUVs for sale in Kenya | GariNice', description: 'Find SUVs for sale in Kenya from dealers and private sellers. Compare Toyota Prado, Harrier, Mazda CX-5, Subaru Forester and more.', intro: '', noindex: false, updatedAt: daysAgo(10) },
  ]
  vs.filter((v) => v.featuredUntil).slice(0, 4).forEach((v) => {
    db.promotions.push({ id: uid(), title: `Homepage spotlight`, placement: 'HOMEPAGE_FEATURED', vehicleId: v.id, dealerId: null, startsAt: daysAgo(2), endsAt: v.featuredUntil, active: true, createdAt: daysAgo(2) })
  })
  db.settings = {
    moderationRequired: true,
    autoApproveVerifiedDealers: true,
    privateFreeListings: 3,
    dealerFreeListings: 10,
    listingDurationDays: 60,
    maintenanceMode: false,
    payments: { MPESA: true, CARD: false, BANK: false },
    homepage: {
      heroTitle: 'Find your next car',
      heroSubtitle: 'Browse thousands of cars from trusted dealers and private sellers across Kenya.',
      announcement: '',
      popularSearches: [
        { label: 'Toyota Prado', href: '/cars?make=toyota&model=land-cruiser-prado' },
        { label: 'Toyota Harrier', href: '/cars?make=toyota&model=harrier' },
        { label: 'Mazda CX-5', href: '/cars?make=mazda&model=cx-5' },
        { label: 'Subaru Forester', href: '/cars?make=subaru&model=forester' },
        { label: 'Nissan X-Trail', href: '/cars?make=nissan&model=x-trail' },
        { label: 'Cars under 1M', href: '/cars/price/under-1m' },
        { label: 'Pickups', href: '/cars/body/pickup-truck' },
        { label: 'Hybrids', href: '/cars?fuel=hybrid' },
      ],
    },
  }
  db.auditLogs.push({ id: uid(), actorId: superAdmin.id, action: 'SYSTEM_SEEDED', entityType: 'system', entityId: null, meta: { vehicles: vs.length }, ip: '127.0.0.1', createdAt: new Date(NOW).toISOString() })
  return db
}

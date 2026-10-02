import { LIMITS, SELLER_ROLES } from '../../../lib/constants'
import { slugify } from '../../../lib/format'
import { dealerProfileSchema, staffInviteSchema, vehicleDraftSchema, vehicleSchema } from '../../../lib/schemas'
import { hashPassword, randomToken } from '../crypto'
import { now, paginate, uid } from '../db'
import {
  ApiError, audit, badRequest, canManageVehicle, dealerFor, forbidden, isAdmin, notFound, rateLimit,
  requireUser, track, validate,
} from '../http'
import { applySellerAction, submitListing } from '../listingService'
import { buildVehicleSlug, computeEstimates, lookups, toCard, toOwnerView } from '../vehicleUtils'
import { publicUser } from './auth'

const DAY = 86_400_000

/** Resolves foreign keys and ownership-sensitive fields server-side. Never trusts the client. */
function normalizeVehicleInput(ctx, data, existing) {
  const { db, user } = ctx
  const dealer = dealerFor(db, user)
  const out = { ...data }

  // Seller identity is derived from the session, never the payload.
  if (out.sellerType === 'DEALER' && !dealer && !isAdmin(user)) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Only dealer accounts can list as a dealer.', { sellerType: 'Your account is not linked to a dealership' })
  }
  if (out.brandId || out.modelId) {
    const brand = db.brands.find((b) => b.id === (out.brandId ?? existing?.brandId) && b.active)
    const model = db.models.find((m) => m.id === (out.modelId ?? existing?.modelId))
    if (!brand) throw new ApiError(422, 'VALIDATION_FAILED', 'Unknown make.', { brandId: 'Select a valid make' })
    if (out.modelId && (!model || model.brandId !== brand.id)) throw new ApiError(422, 'VALIDATION_FAILED', 'Model does not belong to make.', { modelId: 'Select a model for this make' })
  }
  const checkRef = (key, table, label) => {
    if (out[key] && !db[table].some((x) => x.id === out[key])) throw new ApiError(422, 'VALIDATION_FAILED', `Unknown ${label}.`, { [key]: `Select a valid ${label}` })
  }
  checkRef('bodyTypeId', 'bodyTypes', 'body type')
  checkRef('fuelTypeId', 'fuelTypes', 'fuel type')
  checkRef('transmissionId', 'transmissions', 'transmission')
  if (out.features) {
    const valid = new Set(db.features.map((f) => f.slug))
    out.features = out.features.filter((f) => valid.has(f))
  }
  if (out.images) {
    const known = new Set([...(existing?.images || []).map((i) => i.id), ...db.uploads.filter((u) => u.uploaderId === user.id || isAdmin(user)).map((u) => u.id)])
    for (const img of out.images) {
      if (!known.has(img.id)) throw new ApiError(422, 'VALIDATION_FAILED', 'One or more images were not uploaded by you.', { images: 'Please re-upload your photos' })
    }
    // Use server-side URLs for each upload, ignoring client-supplied URLs.
    out.images = out.images.map((img) => {
      const up = db.uploads.find((u) => u.id === img.id)
      const prev = existing?.images?.find((i) => i.id === img.id)
      return up ? { id: up.id, url: up.url, thumb: up.thumb, width: up.width, height: up.height, alt: img.alt || '' } : prev
    })
  }
  if (out.authorityDocUrl) {
    const doc = db.uploads.find((u) => u.id === out.authorityDocUrl && u.kind === 'document')
    if (!doc && out.authorityDocUrl !== existing?.authorityDocUrl) throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid document.', { authorityDocUrl: 'Upload the Authority to Sell document again' })
    if (doc) {
      if (doc.uploaderId !== user.id && !isAdmin(user)) throw forbidden()
      out.authorityDocUrl = doc.url
    }
  }
  if (out.town) {
    const loc = db.locations.find((l) => l.name.toLowerCase() === out.town.toLowerCase())
    out.locationSlug = loc ? loc.slug : slugify(out.town)
  }
  if (out.contact) {
    out.contact = {
      ...out.contact,
      phoneNumber: out.contact.phone ? out.contact.phoneNumber : out.contact.phoneNumber || '',
      whatsappNumber: out.contact.whatsapp ? out.contact.whatsappNumber : out.contact.whatsappNumber || '',
    }
  }
  return { out, dealer }
}

function deriveFields(db, v) {
  const L = lookups(db)
  const brand = L.brands.get(v.brandId)
  const model = L.models.get(v.modelId)
  if (brand && model && v.year) {
    const titleChanged = !v.slug || !v.slug.startsWith(slugify(`${v.year} ${brand.name} ${model.name}`))
    if (titleChanged) {
      v.slug = buildVehicleSlug(v, brand, model)
      v.ref = v.slug.split('-').pop().toUpperCase()
    }
  }
  if (v.engineCc && v.price && v.bodyTypeId && v.fuelTypeId) {
    v.estimates = computeEstimates(v, L.bodyTypes.get(v.bodyTypeId)?.slug, L.fuelTypes.get(v.fuelTypeId)?.slug)
  }
}

function assertSeller(ctx) {
  const user = requireUser(ctx)
  if (user.role === 'BUYER') {
    // A buyer who lists a car becomes a private seller.
    user.role = 'PRIVATE_SELLER'
    audit(ctx, 'ROLE_UPGRADED', 'user', user.id, { to: 'PRIVATE_SELLER' })
  }
  if (!SELLER_ROLES.includes(user.role) && !isAdmin(user)) throw forbidden()
  return user
}

function scopeFor(db, user) {
  const dealer = dealerFor(db, user)
  return dealer ? (v) => v.dealerId === dealer.id : (v) => v.sellerId === user.id
}

export default function register(r) {
  r.get('/api/me/vehicles', async (ctx) => {
    const user = requireUser(ctx)
    const { db, query } = ctx
    const L = lookups(db)
    const inScope = scopeFor(db, user)
    let rows = db.vehicles.filter((v) => !v.deletedAt && inScope(v))
    const counts = rows.reduce((m, v) => ({ ...m, [v.status]: (m[v.status] || 0) + 1 }), { ALL: rows.length })
    if (query.status && query.status !== 'ALL') rows = rows.filter((v) => v.status === query.status)
    if (query.q) {
      const q = query.q.toLowerCase()
      rows = rows.filter((v) => toCard(v, L).title.toLowerCase().includes(q) || v.ref.toLowerCase().includes(q))
    }
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const page = paginate(rows, query.page, 20)
    const msgCount = (id) => db.conversations.filter((c) => c.vehicleId === id).length
    return {
      ...page,
      counts,
      items: page.items.map((v) => ({
        ...toCard(v, L),
        expiresAt: v.expiresAt,
        favouritesCount: v.favouritesCount,
        enquiries: msgCount(v.id),
        changesRequested: v.changesRequested,
        hiddenByAdmin: v.hiddenByAdmin,
        lastModeration: v.moderation?.at(-1) || null,
        sellerName: L.users.get(v.sellerId)?.name,
      })),
    }
  })

  r.get('/api/me/quota', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const dealer = dealerFor(db, user)
    const active = (pred) => db.vehicles.filter((v) => !v.deletedAt && ['PUBLISHED', 'PENDING_REVIEW', 'PAUSED'].includes(v.status) && pred(v)).length
    if (dealer) {
      const live = db.purchases.filter((p) => p.dealerId === dealer.id && new Date(p.endsAt) > new Date())
      const allowance = live.length ? live.reduce((n, p) => n + (db.packages.find((x) => x.id === p.packageId)?.listingLimit || 0), 0) : db.settings.dealerFreeListings
      const pkg = live[0] ? db.packages.find((p) => p.id === live[0].packageId) : null
      return { used: active((v) => v.dealerId === dealer.id), allowance, packageName: pkg?.name || 'Free allowance', renewsAt: live[0]?.endsAt || null }
    }
    return { used: active((v) => v.sellerId === user.id && !v.packageId), allowance: db.settings.privateFreeListings, packageName: 'Free listings', renewsAt: null }
  })

  r.post('/api/vehicles', async (ctx) => {
    const user = assertSeller(ctx)
    rateLimit(ctx, 'create-listing', 20, 60 * 60_000)
    const { db } = ctx
    const submit = !!ctx.body?.submit
    const data = validate(submit ? vehicleSchema : vehicleDraftSchema, ctx.body?.data)
    const { out, dealer } = normalizeVehicleInput(ctx, data)
    const v = {
      id: uid(), ref: null, slug: null, sellerId: user.id, dealerId: dealer?.id || null,
      sellerType: dealer ? 'DEALER' : out.sellerType === 'AGENT' ? 'AGENT' : 'PRIVATE',
      authorityDocUrl: null, features: [], images: [], negotiable: false, currency: 'KES', variant: '',
      contact: { inApp: true, phone: false, whatsapp: false, email: false },
      status: 'DRAFT', hiddenByAdmin: false, changesRequested: null, featuredUntil: null, boostedUntil: null, packageId: null,
      views: 0, favouritesCount: 0, createdAt: now(), updatedAt: now(), publishedAt: null, expiresAt: null, soldAt: null, deletedAt: null, moderation: [],
      ...out,
    }
    v.sellerType = dealer ? 'DEALER' : out.sellerType === 'AGENT' ? 'AGENT' : 'PRIVATE'
    deriveFields(db, v)
    if (!v.slug) {
      v.slug = `draft-${uid().slice(0, 8)}`
      v.ref = randomToken(4).toUpperCase()
    }
    db.vehicles.push(v)
    track(ctx, 'LISTING_CREATED', { vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId })
    audit(ctx, 'LISTING_CREATED', 'vehicle', v.id)
    let status = v.status
    if (submit) status = submitListing(ctx, v)
    return { status: 201, data: { vehicle: toOwnerView(v, db, lookups(db)), status } }
  })

  r.patch('/api/vehicles/:id', async (ctx) => {
    requireUser(ctx)
    const { db } = ctx
    const v = db.vehicles.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!v) throw notFound('Listing not found.')
    if (!canManageVehicle(db, ctx.user, v)) throw forbidden()
    const submit = !!ctx.body?.submit
    const merged = { ...v, ...(ctx.body?.data || {}) }
    const data = validate(submit || v.status === 'PUBLISHED' ? vehicleSchema : vehicleDraftSchema, submit || v.status === 'PUBLISHED' ? merged : ctx.body?.data)
    const { out } = normalizeVehicleInput(ctx, data, v)
    // Never allow these through PATCH.
    for (const k of ['sellerId', 'dealerId', 'status', 'views', 'featuredUntil', 'boostedUntil', 'packageId', 'publishedAt', 'moderation']) delete out[k]
    if (!isAdmin(ctx.user) && dealerFor(db, ctx.user)) out.sellerType = 'DEALER'

    const contentChanged = v.status === 'PUBLISHED' && (
      JSON.stringify(out.images?.map((i) => i.id)) !== JSON.stringify(v.images.map((i) => i.id)) ||
      (out.description && out.description !== v.description) || (out.modelId && out.modelId !== v.modelId)
    )
    Object.assign(v, out, { updatedAt: now() })
    deriveFields(db, v)
    audit(ctx, 'LISTING_UPDATED', 'vehicle', v.id)
    let status = v.status
    if (contentChanged && db.settings.moderationRequired && !isAdmin(ctx.user)) {
      const dealer = v.dealerId ? db.dealers.find((d) => d.id === v.dealerId) : null
      if (!(db.settings.autoApproveVerifiedDealers && dealer?.verified)) {
        v.status = 'PENDING_REVIEW'
        v.moderation.push({ id: uid(), action: 'RESUBMITTED', status: 'PENDING_REVIEW', byId: ctx.user.id, note: 'Photos or description changed', at: now() })
        status = v.status
      }
    }
    if (submit && ['DRAFT', 'REJECTED', 'EXPIRED'].includes(v.status)) status = submitListing(ctx, v)
    return { vehicle: toOwnerView(v, db, lookups(db)), status }
  })

  r.post('/api/vehicles/:id/status', async (ctx) => {
    requireUser(ctx)
    const { db } = ctx
    const v = db.vehicles.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!v) throw notFound('Listing not found.')
    if (!canManageVehicle(db, ctx.user, v)) throw forbidden()
    const status = applySellerAction(ctx, v, ctx.body?.action)
    audit(ctx, `LISTING_${String(ctx.body?.action).toUpperCase()}`, 'vehicle', v.id)
    return { vehicle: toOwnerView(v, db, lookups(db)), status }
  })

  r.delete('/api/vehicles/:id', async (ctx) => {
    requireUser(ctx)
    const v = ctx.db.vehicles.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!v) throw notFound('Listing not found.')
    if (!canManageVehicle(ctx.db, ctx.user, v)) throw forbidden()
    v.deletedAt = now()
    v.status = 'ARCHIVED'
    audit(ctx, 'LISTING_DELETED', 'vehicle', v.id)
    return { ok: true }
  })

  // Uploads: in production this returns a pre-signed object-storage URL; the server
  // then validates the object, strips metadata and generates WebP/AVIF variants.
  r.post('/api/uploads', async (ctx) => {
    const user = requireUser(ctx)
    rateLimit(ctx, 'upload', 60, 10 * 60_000)
    const { kind = 'image', dataUrl, thumbDataUrl, width, height, mime, name } = ctx.body || {}
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw badRequest('Invalid upload.')
    const declared = dataUrl.slice(5, dataUrl.indexOf(';'))
    const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
    if (kind === 'image') {
      if (!['image/webp', 'image/jpeg', 'image/png', 'image/avif'].includes(declared)) throw new ApiError(415, 'UNSUPPORTED_MEDIA', 'Only JPG, PNG, WebP or AVIF images are allowed.')
      if (bytes > LIMITS.maxImageBytes) throw new ApiError(413, 'TOO_LARGE', 'Image is too large.')
      if (!width || !height || width < 400 || height < 300) throw badRequest('Image is too small (minimum 400×300px).')
    } else if (kind === 'document') {
      if (!LIMITS.acceptedDocTypes.includes(declared) && !LIMITS.acceptedDocTypes.includes(mime)) throw new ApiError(415, 'UNSUPPORTED_MEDIA', 'Upload a PDF, JPG or PNG document.')
      if (bytes > LIMITS.maxDocumentBytes) throw new ApiError(413, 'TOO_LARGE', 'Document must be under 5MB.')
    } else throw badRequest('Unknown upload type.')
    const up = { id: uid(), kind, uploaderId: user.id, url: dataUrl, thumb: thumbDataUrl || null, width: width || null, height: height || null, mime: declared, name: String(name || '').slice(0, 120), bytes, createdAt: now() }
    ctx.db.uploads.push(up)
    return { status: 201, data: { id: up.id, url: up.url, thumb: up.thumb, width: up.width, height: up.height, name: up.name } }
  })

  r.get('/api/me/analytics', async (ctx) => {
    const user = requireUser(ctx)
    const { db, query } = ctx
    const days = Math.min(Number(query.days) || 30, 365)
    const since = Date.now() - days * DAY
    const inScope = scopeFor(db, user)
    const mine = db.vehicles.filter((v) => !v.deletedAt && inScope(v))
    const ids = new Set(mine.map((v) => v.id))
    const events = db.analyticsEvents.filter((e) => e.vehicleId && ids.has(e.vehicleId) && new Date(e.createdAt).getTime() >= since)
    const sum = (type) => events.filter((e) => e.type === type).reduce((n, e) => n + (e.count || 1), 0)
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * DAY)
      return { date: d.toISOString().slice(0, 10), views: 0, contacts: 0 }
    })
    const idx = new Map(series.map((s, i) => [s.date, i]))
    for (const e of events) {
      const i = idx.get(e.createdAt.slice(0, 10))
      if (i == null) continue
      if (e.type === 'VEHICLE_VIEW') series[i].views += e.count || 1
      if (['PHONE_CLICK', 'WHATSAPP_CLICK', 'MESSAGE', 'EMAIL_CLICK'].includes(e.type)) series[i].contacts += e.count || 1
    }
    const L = lookups(db)
    const perListing = mine.filter((v) => ['PUBLISHED', 'SOLD', 'PAUSED'].includes(v.status)).map((v) => {
      const ev = events.filter((e) => e.vehicleId === v.id)
      const s = (t) => ev.filter((e) => e.type === t).reduce((n, e) => n + (e.count || 1), 0)
      const views = s('VEHICLE_VIEW')
      const contacts = s('PHONE_CLICK') + s('WHATSAPP_CLICK') + s('MESSAGE') + s('EMAIL_CLICK')
      return { id: v.id, slug: v.slug, title: toCard(v, L).title, status: v.status, image: v.images[0], price: v.price, views, contacts, favourites: s('FAVOURITE'), conversion: views ? Math.round((contacts / views) * 1000) / 10 : 0 }
    }).sort((a, b) => b.views - a.views)
    const conversations = db.conversations.filter((c) => ids.has(c.vehicleId))
    return {
      days,
      totals: {
        activeListings: mine.filter((v) => v.status === 'PUBLISHED').length,
        pending: mine.filter((v) => v.status === 'PENDING_REVIEW').length,
        sold: mine.filter((v) => v.status === 'SOLD').length,
        views: sum('VEHICLE_VIEW'),
        phoneClicks: sum('PHONE_CLICK'),
        whatsappClicks: sum('WHATSAPP_CLICK'),
        messages: sum('MESSAGE'),
        favourites: sum('FAVOURITE'),
        shares: sum('SHARE'),
        enquiries: conversations.filter((c) => new Date(c.createdAt).getTime() >= since).length,
      },
      series,
      perListing,
    }
  })

  r.get('/api/me/leads', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const inScope = scopeFor(db, user)
    const L = lookups(db)
    const mine = new Map(db.vehicles.filter((v) => !v.deletedAt && inScope(v)).map((v) => [v.id, v]))
    const convLeads = db.conversations.filter((c) => mine.has(c.vehicleId)).map((c) => {
      const v = mine.get(c.vehicleId)
      const buyer = L.users.get(c.buyerId)
      const replied = db.messages.some((m) => m.conversationId === c.id && m.senderId !== c.buyerId)
      return { id: c.id, kind: 'MESSAGE', vehicle: { id: v.id, title: toCard(v, L).title, slug: v.slug, image: v.images[0] }, contactName: buyer?.name || 'Buyer', createdAt: c.createdAt, lastActivityAt: c.lastMessageAt, status: replied ? 'RESPONDED' : 'NEW', conversationId: c.id, preview: c.lastMessagePreview }
    })
    const clickLeads = db.analyticsEvents
      .filter((e) => mine.has(e.vehicleId) && ['PHONE_CLICK', 'WHATSAPP_CLICK', 'EMAIL_CLICK'].includes(e.type) && Date.now() - new Date(e.createdAt).getTime() < 30 * DAY)
      .slice(-50)
      .map((e) => {
        const v = mine.get(e.vehicleId)
        return { id: e.id, kind: e.type, vehicle: { id: v.id, title: toCard(v, L).title, slug: v.slug, image: v.images[0] }, contactName: e.userId ? L.users.get(e.userId)?.name : 'Anonymous visitor', createdAt: e.createdAt, lastActivityAt: e.createdAt, status: 'CLICK' }
      })
    const items = [...convLeads, ...clickLeads].sort((a, b) => (b.lastActivityAt || b.createdAt).localeCompare(a.lastActivityAt || a.createdAt))
    return paginate(items, ctx.query.page, 25)
  })

  // ---- dealer management -----------------------------------------------------------
  r.get('/api/dealer', async (ctx) => {
    const user = requireUser(ctx)
    const dealer = dealerFor(ctx.db, user)
    if (!dealer) throw notFound('Your account is not linked to a dealership.')
    return { dealer, canEdit: dealer.ownerId === user.id }
  })

  r.patch('/api/dealer', async (ctx) => {
    const user = requireUser(ctx)
    const dealer = dealerFor(ctx.db, user)
    if (!dealer) throw notFound('Your account is not linked to a dealership.')
    if (dealer.ownerId !== user.id) throw forbidden('Only the dealership owner can edit the storefront.')
    const data = validate(dealerProfileSchema, ctx.body)
    for (const key of ['logoUrl', 'coverUrl']) {
      if (data[key] && data[key] !== dealer[key]) {
        const up = ctx.db.uploads.find((u) => u.id === data[key] && u.uploaderId === user.id)
        if (!up) throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid image.', { [key]: 'Upload the image again' })
        data[key] = up.url
      }
    }
    const loc = ctx.db.locations.find((l) => l.name.toLowerCase() === data.town.toLowerCase())
    Object.assign(dealer, data, { locationSlug: loc?.slug || slugify(data.town) })
    audit(ctx, 'DEALER_UPDATED', 'dealer', dealer.id)
    return { dealer }
  })

  r.get('/api/dealer/staff', async (ctx) => {
    const user = requireUser(ctx)
    const dealer = dealerFor(ctx.db, user)
    if (!dealer) throw notFound('Your account is not linked to a dealership.')
    const items = ctx.db.dealerStaff.filter((s) => s.dealerId === dealer.id).map((s) => {
      const u = ctx.db.users.find((x) => x.id === s.userId)
      return { userId: s.userId, role: s.role, name: u?.name, email: u?.email, lastLoginAt: u?.lastLoginAt, addedAt: s.createdAt }
    })
    return { items, canManage: dealer.ownerId === user.id }
  })

  r.post('/api/dealer/staff', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const dealer = dealerFor(db, user)
    if (!dealer || dealer.ownerId !== user.id) throw forbidden('Only the dealership owner can add staff.')
    rateLimit(ctx, 'staff-invite', 10, 60 * 60_000)
    const data = validate(staffInviteSchema, ctx.body)
    if (db.users.some((u) => u.email === data.email && !u.deletedAt)) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'That email already has an account.', { email: 'This email is already registered' })
    }
    const tempPassword = `Gn${randomToken(4)}9!`
    const staff = { id: uid(), name: data.name, email: data.email, phone: null, role: 'DEALER_STAFF', passwordHash: await hashPassword(tempPassword), emailVerified: false, verified: false, suspended: false, createdAt: now(), lastLoginAt: null, deletedAt: null }
    db.users.push(staff)
    db.profiles.push({ id: uid(), userId: staff.id, location: dealer.town, bio: '', avatarUrl: null, notifyEmail: true, notifySms: false, notifyWhatsapp: false })
    db.dealerStaff.push({ id: uid(), dealerId: dealer.id, userId: staff.id, role: 'STAFF', createdAt: now() })
    db.outbox.unshift({ id: uid(), channel: 'EMAIL', to: staff.email, userId: staff.id, type: 'STAFF_INVITE', subject: `You've been added to ${dealer.name} on GariNice`, body: `Sign in with your email and temporary password: ${tempPassword}`, status: 'QUEUED', createdAt: now() })
    audit(ctx, 'STAFF_ADDED', 'dealer', dealer.id, { staffId: staff.id })
    return { status: 201, data: { user: publicUser(db, staff), tempPassword } }
  })

  r.delete('/api/dealer/staff/:userId', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const dealer = dealerFor(db, user)
    if (!dealer || dealer.ownerId !== user.id) throw forbidden('Only the dealership owner can remove staff.')
    if (ctx.params.userId === user.id) throw badRequest('You cannot remove yourself.')
    const link = db.dealerStaff.find((s) => s.dealerId === dealer.id && s.userId === ctx.params.userId)
    if (!link) throw notFound('Staff member not found.')
    db.dealerStaff = db.dealerStaff.filter((s) => s !== link)
    const staff = db.users.find((u) => u.id === ctx.params.userId)
    if (staff) {
      staff.suspended = true
      db.sessions = db.sessions.filter((s) => s.userId !== staff.id)
    }
    audit(ctx, 'STAFF_REMOVED', 'dealer', dealer.id, { staffId: ctx.params.userId })
    return { ok: true }
  })
}

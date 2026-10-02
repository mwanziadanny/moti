// Listing state machine. Every status change goes through here so rules (quota,
// moderation, notifications, analytics, audit) are applied consistently.
import { ADMIN_ROLES } from '../../lib/constants'
import { now, uid } from './db'
import { ApiError, conflict, notify, track } from './http'
import { lookups, vehicleTitle } from './vehicleUtils'

const DAY = 86_400_000

export const TRANSITIONS = {
  // seller actions
  submit: ['DRAFT', 'REJECTED', 'EXPIRED'],
  pause: ['PUBLISHED'],
  resume: ['PAUSED'],
  mark_sold: ['PUBLISHED', 'PAUSED'],
  relist: ['SOLD', 'EXPIRED', 'ARCHIVED'],
  archive: ['DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD', 'REJECTED', 'EXPIRED'],
  // admin actions
  approve: ['PENDING_REVIEW', 'REJECTED', 'PAUSED', 'DRAFT'],
  reject: ['PENDING_REVIEW', 'PUBLISHED', 'PAUSED'],
  request_changes: ['PENDING_REVIEW', 'PUBLISHED'],
  hide: ['PUBLISHED', 'PENDING_REVIEW'],
  unhide: ['PAUSED'],
  feature: ['PUBLISHED'],
  unfeature: ['PUBLISHED', 'PAUSED', 'SOLD'],
}

export function titleOf(db, v) {
  const L = lookups(db)
  return vehicleTitle(v, L.brands.get(v.brandId), L.models.get(v.modelId))
}

function activeCount(db, predicate, excludeId) {
  return db.vehicles.filter((v) => !v.deletedAt && v.id !== excludeId && ['PUBLISHED', 'PENDING_REVIEW', 'PAUSED'].includes(v.status) && predicate(v)).length
}

/** Throws 402 when the seller has no listing allowance left. Paid (packaged) listings never count. */
export function assertQuota(db, v) {
  const s = db.settings
  if (v.dealerId) {
    const live = db.purchases.filter((p) => p.dealerId === v.dealerId && new Date(p.endsAt) > new Date())
    const allowance = live.length ? live.reduce((n, p) => n + (db.packages.find((x) => x.id === p.packageId)?.listingLimit || 0), 0) : s.dealerFreeListings
    const used = activeCount(db, (x) => x.dealerId === v.dealerId, v.id)
    if (used >= allowance) {
      throw new ApiError(402, 'QUOTA_EXCEEDED', `Your dealership has used all ${allowance} active listing slots. Upgrade your dealer package to publish more.`)
    }
    return
  }
  if (v.packageId) return
  const used = activeCount(db, (x) => x.sellerId === v.sellerId && !x.dealerId && !x.packageId, v.id)
  if (used >= s.privateFreeListings) {
    throw new ApiError(402, 'QUOTA_EXCEEDED', `You have reached the limit of ${s.privateFreeListings} free active listings. Choose a Premium or Featured package for this car, or pause another listing.`)
  }
}

function log(v, action, status, byId, note = null) {
  v.moderation = [...(v.moderation || []), { id: uid(), action, status, byId, note, at: now() }]
}

export function publish(db, v, actorId) {
  const days = db.packages.find((p) => p.id === v.packageId)?.durationDays || db.settings.listingDurationDays || 60
  Object.assign(v, {
    status: 'PUBLISHED', hiddenByAdmin: false, changesRequested: null,
    publishedAt: v.publishedAt || now(), updatedAt: now(),
    expiresAt: new Date(Date.now() + days * DAY).toISOString(),
  })
  log(v, 'APPROVED', 'PUBLISHED', actorId)
  db.analyticsEvents.push({ id: uid(), type: 'LISTING_PUBLISHED', vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId, userId: actorId, count: 1, meta: null, createdAt: now() })
}

/** Seller submits a listing: publish immediately or queue for moderation. */
export function submitListing(ctx, v) {
  const { db } = ctx
  assertQuota(db, v)
  const dealer = v.dealerId ? db.dealers.find((d) => d.id === v.dealerId) : null
  const auto = !db.settings.moderationRequired || (db.settings.autoApproveVerifiedDealers && dealer?.verified)
  if (auto) {
    publish(db, v, ctx.user.id)
    notify(db, v.sellerId, 'LISTING_APPROVED', 'Your listing is live', `${titleOf(db, v)} is now visible to buyers.`, `/vehicle/${v.slug}`)
    return 'PUBLISHED'
  }
  Object.assign(v, { status: 'PENDING_REVIEW', changesRequested: null, updatedAt: now() })
  log(v, 'SUBMITTED', 'PENDING_REVIEW', ctx.user.id)
  for (const admin of db.users.filter((u) => ADMIN_ROLES.includes(u.role) && !u.deletedAt)) {
    db.notifications.unshift({ id: uid(), userId: admin.id, type: 'NEW_ENQUIRY', title: 'Listing awaiting review', body: titleOf(db, v), link: '/admin/listings?status=PENDING_REVIEW', readAt: null, createdAt: now() })
  }
  return 'PENDING_REVIEW'
}

export function applySellerAction(ctx, v, action) {
  const { db } = ctx
  const allowed = TRANSITIONS[action]
  if (!allowed || ['approve', 'reject', 'request_changes', 'hide', 'unhide', 'feature', 'unfeature'].includes(action)) {
    throw new ApiError(400, 'BAD_ACTION', 'Unknown action.')
  }
  if (!allowed.includes(v.status)) throw conflict(`You can’t ${action.replace('_', ' ')} a listing that is ${v.status.toLowerCase().replace('_', ' ')}.`)
  switch (action) {
    case 'submit':
      return submitListing(ctx, v)
    case 'relist':
      v.status = 'DRAFT'
      v.soldAt = null
      return submitListing(ctx, v)
    case 'pause':
      Object.assign(v, { status: 'PAUSED', updatedAt: now() })
      log(v, 'PAUSED', 'PAUSED', ctx.user.id)
      return v.status
    case 'resume':
      if (v.hiddenByAdmin) throw new ApiError(403, 'HIDDEN_BY_ADMIN', 'This listing was hidden by our moderation team. Contact support to restore it.')
      if (v.expiresAt && new Date(v.expiresAt) < new Date()) throw conflict('This listing has expired. Relist it to publish again.')
      assertQuota(db, v)
      Object.assign(v, { status: 'PUBLISHED', updatedAt: now() })
      log(v, 'RESUMED', 'PUBLISHED', ctx.user.id)
      return v.status
    case 'mark_sold':
      Object.assign(v, { status: 'SOLD', soldAt: now(), updatedAt: now(), featuredUntil: null, boostedUntil: null })
      log(v, 'SOLD', 'SOLD', ctx.user.id)
      track(ctx, 'LISTING_SOLD', { vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId })
      // Let buyers who saved or enquired know.
      for (const fav of db.favourites.filter((f) => f.vehicleId === v.id)) {
        notify(db, fav.userId, 'VEHICLE_SOLD', 'A saved car has been sold', `${titleOf(db, v)} is no longer available.`, '/saved')
      }
      return v.status
    case 'archive':
      Object.assign(v, { status: 'ARCHIVED', updatedAt: now() })
      log(v, 'ARCHIVED', 'ARCHIVED', ctx.user.id)
      return v.status
    default:
      throw new ApiError(400, 'BAD_ACTION', 'Unknown action.')
  }
}

export function applyAdminAction(ctx, v, action, note) {
  const { db } = ctx
  const allowed = TRANSITIONS[action]
  if (!allowed) throw new ApiError(400, 'BAD_ACTION', 'Unknown action.')
  if (action === 'delete') return
  if (!allowed.includes(v.status)) throw conflict(`Cannot ${action.replace('_', ' ')} a listing in status ${v.status}.`)
  const title = titleOf(db, v)
  switch (action) {
    case 'approve':
      publish(db, v, ctx.user.id)
      notify(db, v.sellerId, 'LISTING_APPROVED', 'Your listing is live', `${title} has been approved and is now visible to buyers.`, `/vehicle/${v.slug}`)
      break
    case 'reject':
      if (!note) throw new ApiError(422, 'VALIDATION_FAILED', 'A reason is required.', { note: 'Tell the seller why the listing was rejected' })
      Object.assign(v, { status: 'REJECTED', updatedAt: now() })
      log(v, 'REJECTED', 'REJECTED', ctx.user.id, note)
      notify(db, v.sellerId, 'LISTING_REJECTED', 'Your listing was not approved', `${title}: ${note}`, '/dashboard/listings')
      break
    case 'request_changes':
      if (!note) throw new ApiError(422, 'VALIDATION_FAILED', 'Describe the changes needed.', { note: 'Describe what the seller should change' })
      Object.assign(v, { status: 'DRAFT', changesRequested: note, updatedAt: now() })
      log(v, 'CHANGES_REQUESTED', 'DRAFT', ctx.user.id, note)
      notify(db, v.sellerId, 'LISTING_CHANGES_REQUESTED', 'Changes requested on your listing', `${title}: ${note}`, `/sell/vehicle?edit=${v.id}`)
      break
    case 'hide':
      Object.assign(v, { status: 'PAUSED', hiddenByAdmin: true, updatedAt: now() })
      log(v, 'HIDDEN', 'PAUSED', ctx.user.id, note)
      break
    case 'unhide':
      Object.assign(v, { status: 'PUBLISHED', hiddenByAdmin: false, updatedAt: now() })
      log(v, 'UNHIDDEN', 'PUBLISHED', ctx.user.id, note)
      break
    case 'feature':
      Object.assign(v, { featuredUntil: new Date(Date.now() + 14 * DAY).toISOString(), boostedUntil: new Date(Date.now() + 14 * DAY).toISOString() })
      log(v, 'FEATURED', v.status, ctx.user.id, note)
      break
    case 'unfeature':
      Object.assign(v, { featuredUntil: null, boostedUntil: null })
      log(v, 'UNFEATURED', v.status, ctx.user.id, note)
      break
  }
}

/** Lazy scheduler: expires listings and sends expiry reminders. Runs before each request. */
export function runScheduledJobs(db) {
  const t = Date.now()
  for (const v of db.vehicles) {
    if (v.status !== 'PUBLISHED' || !v.expiresAt || v.deletedAt) continue
    const exp = new Date(v.expiresAt).getTime()
    if (exp < t) {
      v.status = 'EXPIRED'
      log(v, 'EXPIRED', 'EXPIRED', null)
      notify(db, v.sellerId, 'LISTING_EXPIRING', 'Your listing has expired', `${titleOf(db, v)} is no longer visible. Relist it from your dashboard.`, '/dashboard/listings')
    } else if (exp - t < 3 * DAY && !v.expiryReminderSent) {
      v.expiryReminderSent = true
      notify(db, v.sellerId, 'LISTING_EXPIRING', 'Your listing expires soon', `${titleOf(db, v)} expires in less than 3 days.`, '/dashboard/listings')
    }
  }
}

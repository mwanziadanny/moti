import { ADMIN_ROLES } from '../../lib/constants'
import { issuesToErrors } from '../../lib/schemas'
import { now, uid } from './db'

export class ApiError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const badRequest = (msg, fieldErrors) => new ApiError(400, 'BAD_REQUEST', msg, fieldErrors)
export const unauthorized = (msg = 'Please sign in to continue.') => new ApiError(401, 'UNAUTHENTICATED', msg)
export const forbidden = (msg = 'You do not have permission to do that.') => new ApiError(403, 'FORBIDDEN', msg)
export const notFound = (msg = 'Not found.') => new ApiError(404, 'NOT_FOUND', msg)
export const conflict = (msg) => new ApiError(409, 'CONFLICT', msg)

/** Parses with a Zod schema; throws a 422 with field errors on failure. */
export function validate(schema, input) {
  const result = schema.safeParse(input ?? {})
  if (!result.success) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Some fields need your attention.', issuesToErrors(result.error.issues))
  }
  return result.data
}

// ---- router -----------------------------------------------------------------------
export function createRouter() {
  const routes = []
  const add = (method, pattern, handler) => {
    const keys = []
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}/?$`)
    routes.push({ method, re, keys, handler, pattern })
  }
  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    patch: (p, h) => add('PATCH', p, h),
    put: (p, h) => add('PUT', p, h),
    delete: (p, h) => add('DELETE', p, h),
    match(method, path) {
      for (const r of routes) {
        if (r.method !== method) continue
        const m = r.re.exec(path)
        if (m) return { handler: r.handler, pattern: r.pattern, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
      }
      return null
    },
  }
}

// ---- guards -----------------------------------------------------------------------
export function requireUser(ctx) {
  if (!ctx.user) throw unauthorized()
  return ctx.user
}

export function requireRole(ctx, roles) {
  const user = requireUser(ctx)
  if (!roles.includes(user.role)) throw forbidden()
  return user
}

export const requireAdmin = (ctx) => requireRole(ctx, ADMIN_ROLES)
export const isAdmin = (user) => !!user && ADMIN_ROLES.includes(user.role)

/** Dealer the user belongs to (owner or staff), if any. */
export function dealerFor(db, user) {
  if (!user) return null
  const link = db.dealerStaff.find((s) => s.userId === user.id)
  return link ? db.dealers.find((d) => d.id === link.dealerId && !d.deletedAt) : null
}

export function canManageVehicle(db, user, vehicle) {
  if (!user || !vehicle) return false
  if (isAdmin(user)) return true
  if (vehicle.sellerId === user.id) return true
  const dealer = dealerFor(db, user)
  return !!dealer && vehicle.dealerId === dealer.id
}

// ---- rate limiting (sliding window, per actor+bucket) -------------------------------
const hits = new Map()
export function rateLimit(ctx, bucket, limit, windowMs) {
  const actor = ctx.user?.id || ctx.ip || 'anon'
  const key = `${bucket}:${actor}`
  const t = Date.now()
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs)
  if (arr.length >= limit) {
    const retry = Math.ceil((windowMs - (t - arr[0])) / 1000)
    throw new ApiError(429, 'RATE_LIMITED', `Too many requests. Please try again in ${retry < 60 ? `${retry}s` : `${Math.ceil(retry / 60)} min`}.`)
  }
  arr.push(t)
  hits.set(key, arr)
}
export const resetRateLimits = () => hits.clear()

// ---- side effects -----------------------------------------------------------------
export function audit(ctx, action, entityType, entityId, meta = null) {
  ctx.db.auditLogs.unshift({ id: uid(), actorId: ctx.user?.id || null, action, entityType, entityId, meta, ip: ctx.ip, createdAt: now() })
}

export function track(ctx, type, data = {}) {
  ctx.db.analyticsEvents.push({ id: uid(), type, userId: ctx.user?.id || null, count: 1, meta: null, vehicleId: null, dealerId: null, sellerId: null, ...data, createdAt: now() })
}

/**
 * Creates an in-app notification and queues email/SMS/WhatsApp deliveries in the
 * outbox according to the recipient's preferences. A worker drains the outbox in
 * production (e.g. via SES / Africa's Talking / WhatsApp Cloud API).
 */
export function notify(db, userId, type, title, body, link = null) {
  const user = db.users.find((u) => u.id === userId)
  if (!user || user.deletedAt) return
  db.notifications.unshift({ id: uid(), userId, type, title, body, link, readAt: null, createdAt: now() })
  const profile = db.profiles.find((p) => p.userId === userId)
  const channels = []
  if (profile?.notifyEmail !== false) channels.push('EMAIL')
  if (profile?.notifySms) channels.push('SMS')
  if (profile?.notifyWhatsapp) channels.push('WHATSAPP')
  for (const channel of channels) {
    db.outbox.unshift({ id: uid(), channel, to: channel === 'EMAIL' ? user.email : user.phone, userId, type, subject: title, body, status: 'QUEUED', createdAt: now() })
  }
  if (db.outbox.length > 500) db.outbox.length = 500
}

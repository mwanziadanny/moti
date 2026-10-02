// Payments: server computes the amount from the package, the gateway confirms via a
// signed webhook, and only the webhook moves a payment to SUCCESS. The frontend only
// ever *polls* status — it can never mark a payment successful.
import { paymentInitSchema } from '../../../lib/schemas'
import { hmacSha256, randomToken } from '../crypto'
import { now, paginate, uid } from '../db'
import { ApiError, audit, canManageVehicle, dealerFor, forbidden, isAdmin, notFound, notify, rateLimit, requireAdmin, requireUser, track, validate } from '../http'
import { titleOf } from '../listingService'

export const WEBHOOK_SECRET = 'mock-mpesa-webhook-secret'
const DAY = 86_400_000
const FINAL = ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']

export async function signWebhook(payload) {
  return hmacSha256(WEBHOOK_SECRET, JSON.stringify(payload))
}

function publicPayment(db, p) {
  const pkg = db.packages.find((x) => x.id === p.packageId)
  const v = p.vehicleId ? db.vehicles.find((x) => x.id === p.vehicleId) : null
  return {
    id: p.id, reference: p.reference, amount: p.amount, currency: p.currency, purpose: p.purpose, status: p.status,
    gateway: p.gateway, method: p.method, phone: p.phone ? `${p.phone.slice(0, 7)}•••${p.phone.slice(-2)}` : null,
    receipt: p.receipt, failureReason: p.failureReason, createdAt: p.createdAt, updatedAt: p.updatedAt, completedAt: p.completedAt,
    package: pkg ? { id: pkg.id, name: pkg.name } : null,
    vehicle: v ? { id: v.id, title: titleOf(db, v), slug: v.slug } : null,
  }
}

function fulfil(db, p) {
  const pkg = db.packages.find((x) => x.id === p.packageId)
  const t = Date.now()
  const purchase = { id: uid(), userId: p.userId, dealerId: null, packageId: pkg.id, paymentId: p.id, vehicleId: p.vehicleId || null, startsAt: now(), endsAt: new Date(t + pkg.durationDays * DAY).toISOString(), createdAt: now() }
  if (pkg.audience === 'DEALER') {
    const user = db.users.find((u) => u.id === p.userId)
    purchase.dealerId = dealerFor(db, user)?.id || null
  } else if (p.vehicleId) {
    const v = db.vehicles.find((x) => x.id === p.vehicleId)
    if (v) {
      v.packageId = pkg.id
      if (pkg.boostDays) v.boostedUntil = new Date(t + pkg.boostDays * DAY).toISOString()
      if (pkg.featured) v.featuredUntil = new Date(t + pkg.boostDays * DAY).toISOString()
      if (v.status === 'PUBLISHED') {
        const ext = new Date(t + pkg.durationDays * DAY).toISOString()
        if (!v.expiresAt || v.expiresAt < ext) v.expiresAt = ext
      }
      v.updatedAt = now()
    }
  }
  db.purchases.push(purchase)
  return purchase
}

/** Simulated Daraja gateway: sends a signed callback a few seconds after the STK push. */
function simulateGateway(server, p) {
  const outcome = p.phone.endsWith('0000') ? 'FAIL' : p.phone.endsWith('1111') ? 'CANCEL' : 'OK'
  setTimeout(async () => {
    const payload = {
      eventId: `evt_${randomToken(8)}`,
      checkoutRequestId: p.gatewayRef,
      resultCode: outcome === 'OK' ? 0 : outcome === 'CANCEL' ? 1032 : 1,
      resultDesc: outcome === 'OK' ? 'The service request is processed successfully.' : outcome === 'CANCEL' ? 'Request cancelled by user' : 'The balance is insufficient for the transaction',
      amount: p.amount,
      receipt: outcome === 'OK' ? `T${randomToken(5).toUpperCase()}` : null,
      phone: p.phone,
    }
    const signature = await signWebhook(payload)
    await server.handle({ method: 'POST', path: '/api/payments/webhook', body: payload, headers: { 'x-gateway-signature': signature }, internal: true })
  }, server.options.gatewayDelayMs ?? 4000)
}

export default function register(r) {
  r.post('/api/payments', async (ctx) => {
    const user = requireUser(ctx)
    rateLimit(ctx, 'payment', 10, 10 * 60_000)
    const { db } = ctx
    const data = validate(paymentInitSchema, ctx.body)

    const existing = db.payments.find((p) => p.userId === user.id && p.idempotencyKey === data.idempotencyKey)
    if (existing) return { payment: publicPayment(db, existing), idempotent: true }

    if (!db.settings.payments?.[data.method]) throw new ApiError(422, 'METHOD_UNAVAILABLE', 'This payment method is not available yet.')
    const pkg = db.packages.find((p) => p.id === data.packageId && p.active && !p.deletedAt)
    if (!pkg) throw notFound('Package not found.')
    if (pkg.audience === 'DEALER' && !dealerFor(db, user)) throw forbidden('Dealer packages are only available to dealer accounts.')
    let vehicle = null
    if (pkg.audience !== 'DEALER') {
      vehicle = db.vehicles.find((v) => v.id === data.vehicleId && !v.deletedAt)
      if (!vehicle) throw new ApiError(422, 'VALIDATION_FAILED', 'Choose the listing to promote.', { vehicleId: 'Choose a listing' })
      if (!canManageVehicle(db, user, vehicle)) throw forbidden()
      if (['SOLD', 'ARCHIVED'].includes(vehicle.status)) throw new ApiError(409, 'CONFLICT', 'This listing cannot be promoted.')
    }
    if (pkg.price === 0) throw new ApiError(422, 'FREE_PACKAGE', 'This package is free — no payment needed.')

    const p = {
      id: uid(), reference: `GNP${Math.floor(100000 + Math.random() * 900000)}`, userId: user.id,
      amount: pkg.price, currency: 'KES', purpose: pkg.audience === 'DEALER' ? 'DEALER_PACKAGE' : 'LISTING_PACKAGE',
      packageId: pkg.id, vehicleId: vehicle?.id || null, status: 'PENDING', gateway: 'MPESA', method: data.method,
      phone: data.phone, gatewayRef: `ws_CO_${Date.now()}${randomToken(3)}`, receipt: null, idempotencyKey: data.idempotencyKey,
      failureReason: null, createdAt: now(), updatedAt: now(), completedAt: null,
    }
    db.payments.unshift(p)
    // STK push accepted by gateway
    p.status = 'PROCESSING'
    audit(ctx, 'PAYMENT_INITIATED', 'payment', p.id, { amount: p.amount, packageId: pkg.id })
    if (!ctx.internalOptions?.manualGateway) simulateGateway(ctx.server, p)
    return { status: 201, data: { payment: publicPayment(db, p) } }
  })

  r.get('/api/payments', async (ctx) => {
    const user = requireUser(ctx)
    const items = ctx.db.payments.filter((p) => p.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => publicPayment(ctx.db, p))
    return paginate(items, ctx.query.page, 25)
  })

  r.get('/api/payments/:id', async (ctx) => {
    const user = requireUser(ctx)
    const p = ctx.db.payments.find((x) => x.id === ctx.params.id)
    if (!p || (p.userId !== user.id && !isAdmin(user))) throw notFound('Payment not found.')
    return { payment: publicPayment(ctx.db, p) }
  })

  r.post('/api/payments/webhook', async (ctx) => {
    const { db } = ctx
    const signature = ctx.headers?.['x-gateway-signature']
    const expected = await signWebhook(ctx.body || {})
    if (!signature || signature !== expected) throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature.')
    const { eventId, checkoutRequestId, resultCode, amount, receipt, resultDesc } = ctx.body
    if (db.webhookEvents.some((e) => e.eventId === eventId)) return { ok: true, duplicate: true }
    db.webhookEvents.push({ id: uid(), eventId, gateway: 'MPESA', payload: ctx.body, receivedAt: now() })

    const p = db.payments.find((x) => x.gatewayRef === checkoutRequestId)
    if (!p) return { ok: true, ignored: 'unknown payment' }
    if (FINAL.includes(p.status)) return { ok: true, duplicate: true }

    p.updatedAt = now()
    const actor = { ...ctx, user: db.users.find((u) => u.id === p.userId) }
    if (resultCode === 0 && Number(amount) === p.amount) {
      Object.assign(p, { status: 'SUCCESS', receipt, completedAt: now() })
      fulfil(db, p)
      track(actor, 'PAYMENT_SUCCESS', { vehicleId: p.vehicleId, meta: { amount: p.amount, packageId: p.packageId } })
      notify(db, p.userId, 'PAYMENT_SUCCESS', 'Payment received', `KES ${p.amount.toLocaleString()} received. Receipt ${receipt}.`, '/dashboard/payments')
    } else {
      const mismatch = resultCode === 0
      Object.assign(p, {
        status: resultCode === 1032 ? 'CANCELLED' : 'FAILED',
        failureReason: mismatch ? 'Amount mismatch — payment flagged for review.' : resultDesc,
      })
      track(actor, 'PAYMENT_FAILED', { vehicleId: p.vehicleId, meta: { amount: p.amount } })
      notify(db, p.userId, 'PAYMENT_FAILED', 'Payment not completed', p.failureReason, '/dashboard/payments')
    }
    audit(actor, `PAYMENT_${p.status}`, 'payment', p.id, { eventId })
    return { ok: true }
  })

  r.post('/api/admin/payments/:id/refund', async (ctx) => {
    requireAdmin(ctx)
    const p = ctx.db.payments.find((x) => x.id === ctx.params.id)
    if (!p) throw notFound('Payment not found.')
    if (p.status !== 'SUCCESS') throw new ApiError(409, 'CONFLICT', 'Only successful payments can be refunded.')
    Object.assign(p, { status: 'REFUNDED', updatedAt: now() })
    audit(ctx, 'PAYMENT_REFUNDED', 'payment', p.id, { amount: p.amount })
    return { payment: publicPayment(ctx.db, p) }
  })
}

export { publicPayment }

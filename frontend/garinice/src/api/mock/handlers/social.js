import { ADMIN_ROLES } from '../../../lib/constants'
import { messageSchema, reportSchema, startConversationSchema } from '../../../lib/schemas'
import { now, paginate, uid } from '../db'
import { ApiError, canManageVehicle, conflict, forbidden, notFound, notify, rateLimit, requireUser, track, validate } from '../http'
import { titleOf } from '../listingService'
import { lookups, toCard } from '../vehicleUtils'

function sideOf(db, user, convo) {
  if (convo.buyerId === user.id) return 'buyer'
  const v = db.vehicles.find((x) => x.id === convo.vehicleId)
  if (canManageVehicle(db, user, v) && !ADMIN_ROLES.includes(user.role)) return 'seller'
  if (v && v.sellerId === user.id) return 'seller'
  return null
}

function unreadFor(db, convo, side, userId) {
  const lastRead = side === 'buyer' ? convo.buyerLastReadAt : convo.sellerLastReadAt
  return db.messages.filter((m) => m.conversationId === convo.id && m.senderId !== userId && (!lastRead || m.createdAt > lastRead)).length
}

/** Everyone on the seller side who should hear about a buyer message. */
function sellerRecipients(db, vehicle) {
  const ids = new Set([vehicle.sellerId])
  if (vehicle.dealerId) db.dealerStaff.filter((s) => s.dealerId === vehicle.dealerId).forEach((s) => ids.add(s.userId))
  return [...ids]
}

function summarize(db, convo, user, L) {
  const side = sideOf(db, user, convo)
  const v = db.vehicles.find((x) => x.id === convo.vehicleId)
  const buyer = L.users.get(convo.buyerId)
  const dealer = v?.dealerId ? L.dealers.get(v.dealerId) : null
  const sellerUser = L.users.get(convo.sellerId)
  return {
    id: convo.id,
    side,
    vehicle: v ? { ...toCard(v, L), status: v.status } : null,
    counterpart: side === 'buyer'
      ? { name: dealer?.name || sellerUser?.name?.split(' ')[0] || 'Seller', logoUrl: dealer?.logoUrl || null, verified: dealer ? dealer.verified : !!sellerUser?.verified, type: dealer ? 'DEALER' : 'PRIVATE' }
      : { name: buyer?.name || 'Buyer', logoUrl: null, verified: false, type: 'BUYER' },
    lastMessageAt: convo.lastMessageAt,
    lastMessagePreview: convo.lastMessagePreview,
    unread: unreadFor(db, convo, side, user.id),
    createdAt: convo.createdAt,
  }
}

export default function register(r) {
  // ---- favourites -------------------------------------------------------------------
  r.get('/api/favourites/ids', async (ctx) => {
    const user = requireUser(ctx)
    return { ids: ctx.db.favourites.filter((f) => f.userId === user.id).map((f) => f.vehicleId) }
  })

  r.get('/api/favourites', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const L = lookups(db)
    const favs = db.favourites.filter((f) => f.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const items = favs
      .map((f) => {
        const v = db.vehicles.find((x) => x.id === f.vehicleId && !x.deletedAt)
        if (!v || !['PUBLISHED', 'SOLD', 'EXPIRED', 'PAUSED'].includes(v.status)) return null
        return { ...toCard(v, L), savedAt: f.createdAt, available: v.status === 'PUBLISHED' }
      })
      .filter(Boolean)
    return paginate(items, ctx.query.page, 48)
  })

  r.post('/api/favourites', async (ctx) => {
    const user = requireUser(ctx)
    rateLimit(ctx, 'favourite', 60, 60_000)
    const { db } = ctx
    const v = db.vehicles.find((x) => x.id === ctx.body?.vehicleId && !x.deletedAt && ['PUBLISHED', 'SOLD'].includes(x.status))
    if (!v) throw notFound('This vehicle is no longer available.')
    if (!db.favourites.some((f) => f.userId === user.id && f.vehicleId === v.id)) {
      db.favourites.push({ id: uid(), userId: user.id, vehicleId: v.id, createdAt: now() })
      v.favouritesCount += 1
      track(ctx, 'FAVOURITE', { vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId })
    }
    return { status: 201, data: { ok: true } }
  })

  r.delete('/api/favourites/:vehicleId', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const before = db.favourites.length
    db.favourites = db.favourites.filter((f) => !(f.userId === user.id && f.vehicleId === ctx.params.vehicleId))
    if (db.favourites.length !== before) {
      const v = db.vehicles.find((x) => x.id === ctx.params.vehicleId)
      if (v) v.favouritesCount = Math.max(0, v.favouritesCount - 1)
    }
    return { ok: true }
  })

  // ---- conversations ----------------------------------------------------------------
  r.get('/api/conversations', async (ctx) => {
    const user = requireUser(ctx)
    const { db, query } = ctx
    const L = lookups(db)
    let items = db.conversations
      .filter((c) => !c.deletedAt && sideOf(db, user, c))
      .map((c) => summarize(db, c, user, L))
    if (query.side === 'buying') items = items.filter((c) => c.side === 'buyer')
    if (query.side === 'selling') items = items.filter((c) => c.side === 'seller')
    items.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
    return { items, unread: items.reduce((n, c) => n + c.unread, 0) }
  })

  r.get('/api/conversations/unread', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    let n = 0
    for (const c of db.conversations) {
      const side = sideOf(db, user, c)
      if (side) n += unreadFor(db, c, side, user.id)
    }
    return { unread: n, notifications: db.notifications.filter((x) => x.userId === user.id && !x.readAt).length }
  })

  r.post('/api/conversations', async (ctx) => {
    const user = requireUser(ctx)
    rateLimit(ctx, 'start-conversation', 20, 60 * 60_000)
    const { db } = ctx
    const data = validate(startConversationSchema, ctx.body)
    const v = db.vehicles.find((x) => x.id === data.vehicleId && !x.deletedAt)
    if (!v || v.status !== 'PUBLISHED') throw notFound('This vehicle is no longer available.')
    if (!v.contact?.inApp) throw forbidden('This seller does not accept in-app messages.')
    if (canManageVehicle(db, user, v) && !ADMIN_ROLES.includes(user.role)) throw conflict('You cannot message yourself about your own listing.')
    let convo = db.conversations.find((c) => c.vehicleId === v.id && c.buyerId === user.id && !c.deletedAt)
    if (!convo) {
      convo = { id: uid(), vehicleId: v.id, buyerId: user.id, sellerId: v.sellerId, dealerId: v.dealerId, createdAt: now(), lastMessageAt: null, lastMessagePreview: '', buyerLastReadAt: null, sellerLastReadAt: null, deletedAt: null }
      db.conversations.push(convo)
    }
    const msg = { id: uid(), conversationId: convo.id, senderId: user.id, body: data.body, createdAt: now(), deletedAt: null }
    db.messages.push(msg)
    Object.assign(convo, { lastMessageAt: msg.createdAt, lastMessagePreview: data.body.slice(0, 140), buyerLastReadAt: msg.createdAt })
    track(ctx, 'MESSAGE', { vehicleId: v.id, dealerId: v.dealerId, sellerId: v.sellerId })
    const title = titleOf(db, v)
    for (const id of sellerRecipients(db, v)) {
      notify(db, id, 'NEW_ENQUIRY', `New enquiry: ${title}`, `${user.name.split(' ')[0]}: ${data.body.slice(0, 120)}`, `/dashboard/messages?c=${convo.id}`)
    }
    return { status: 201, data: { conversationId: convo.id } }
  })

  r.get('/api/conversations/:id', async (ctx) => {
    const user = requireUser(ctx)
    const { db } = ctx
    const convo = db.conversations.find((c) => c.id === ctx.params.id && !c.deletedAt)
    if (!convo) throw notFound('Conversation not found.')
    const side = sideOf(db, user, convo)
    if (!side) throw forbidden()
    const L = lookups(db)
    const messages = db.messages
      .filter((m) => m.conversationId === convo.id && !m.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === user.id, senderName: m.senderId === user.id ? 'You' : (L.users.get(m.senderId)?.name || '').split(' ')[0] }))
    const summary = summarize(db, convo, user, L)
    if (side === 'buyer') convo.buyerLastReadAt = now()
    else convo.sellerLastReadAt = now()
    const v = db.vehicles.find((x) => x.id === convo.vehicleId)
    const otherRead = side === 'buyer' ? convo.sellerLastReadAt : convo.buyerLastReadAt
    return { conversation: { ...summary, unread: 0, otherLastReadAt: otherRead, canReply: !!v && !v.deletedAt }, messages }
  })

  r.post('/api/conversations/:id/messages', async (ctx) => {
    const user = requireUser(ctx)
    rateLimit(ctx, 'message', 30, 60_000)
    const { db } = ctx
    const convo = db.conversations.find((c) => c.id === ctx.params.id && !c.deletedAt)
    if (!convo) throw notFound('Conversation not found.')
    const side = sideOf(db, user, convo)
    if (!side) throw forbidden()
    const data = validate(messageSchema, ctx.body)
    const msg = { id: uid(), conversationId: convo.id, senderId: user.id, body: data.body, createdAt: now(), deletedAt: null }
    db.messages.push(msg)
    Object.assign(convo, { lastMessageAt: msg.createdAt, lastMessagePreview: data.body.slice(0, 140) })
    if (side === 'buyer') convo.buyerLastReadAt = msg.createdAt
    else convo.sellerLastReadAt = msg.createdAt
    const v = db.vehicles.find((x) => x.id === convo.vehicleId)
    const title = v ? titleOf(db, v) : 'your enquiry'
    if (side === 'buyer') {
      for (const id of sellerRecipients(db, v)) notify(db, id, 'NEW_MESSAGE', `New message about ${title}`, data.body.slice(0, 120), `/dashboard/messages?c=${convo.id}`)
    } else {
      notify(db, convo.buyerId, 'NEW_MESSAGE', `Reply about ${title}`, data.body.slice(0, 120), `/messages?c=${convo.id}`)
    }
    return { status: 201, data: { message: { id: msg.id, body: msg.body, createdAt: msg.createdAt, mine: true, senderName: 'You' } } }
  })

  // ---- notifications ------------------------------------------------------------------
  r.get('/api/notifications', async (ctx) => {
    const user = requireUser(ctx)
    const items = ctx.db.notifications.filter((n) => n.userId === user.id).slice(0, 50)
    return { items, unread: items.filter((n) => !n.readAt).length }
  })

  r.post('/api/notifications/read', async (ctx) => {
    const user = requireUser(ctx)
    const ids = ctx.body?.ids
    for (const n of ctx.db.notifications) {
      if (n.userId === user.id && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = now()
    }
    return { ok: true }
  })

  // ---- reports ----------------------------------------------------------------------
  r.post('/api/reports', async (ctx) => {
    rateLimit(ctx, 'report', 5, 60 * 60_000)
    const { db } = ctx
    const data = validate(reportSchema, ctx.body)
    const v = db.vehicles.find((x) => x.id === data.vehicleId && !x.deletedAt)
    if (!v) throw notFound('This vehicle could not be found.')
    const dupe = db.reports.find((x) => x.vehicleId === v.id && x.status === 'OPEN' && ((ctx.user && x.reporterId === ctx.user.id) || (!ctx.user && x.reporterIp === ctx.ip)))
    if (dupe) throw new ApiError(409, 'ALREADY_REPORTED', 'You have already reported this listing. Our team is reviewing it.')
    const report = {
      id: uid(), vehicleId: v.id, reporterId: ctx.user?.id || null, reporterEmail: ctx.user ? null : (data.email || null), reporterIp: ctx.ip,
      reason: data.reason, details: data.details || '', status: 'OPEN', resolution: null, createdAt: now(), resolvedAt: null, resolvedById: null,
    }
    db.reports.unshift(report)
    for (const admin of db.users.filter((u) => ADMIN_ROLES.includes(u.role) && !u.deletedAt)) {
      db.notifications.unshift({ id: uid(), userId: admin.id, type: 'ACCOUNT', title: 'New listing report', body: `${titleOf(db, v)} — ${data.reason.replace('_', ' ').toLowerCase()}`, link: '/admin/reports', readAt: null, createdAt: now() })
    }
    return { status: 201, data: { ok: true, id: report.id } }
  })
}

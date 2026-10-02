import { ROLES } from '../../../lib/constants'
import { slugify } from '../../../lib/format'
import {
  bodyTypeSchema, brandSchema, cmsPageSchema, modelSchema, packageSchema, promotionSchema, seoRecordSchema,
} from '../../../lib/schemas'
import { now, paginate, uid } from '../db'
import { ApiError, audit, badRequest, conflict, forbidden, notFound, notify, requireAdmin, requireRole, validate } from '../http'
import { applyAdminAction, titleOf } from '../listingService'
import { lookups, toCard, toOwnerView } from '../vehicleUtils'
import { publicPayment } from './payments'

const DAY = 86_400_000

/** Generic audited CRUD for simple admin-managed tables. */
function crud(r, path, table, schema, { entity, beforeSave, canDelete, sort } = {}) {
  r.get(`/api/admin/${path}`, async (ctx) => {
    requireAdmin(ctx)
    let rows = ctx.db[table].filter((x) => !x.deletedAt)
    if (ctx.query.q) {
      const q = ctx.query.q.toLowerCase()
      rows = rows.filter((x) => JSON.stringify(x).toLowerCase().includes(q))
    }
    // Exact-match filters on any other field, e.g. ?brandId=…
    for (const [k, v] of Object.entries(ctx.query)) {
      if (k !== 'q' && v) rows = rows.filter((x) => String(x[k]) === String(v))
    }
    if (sort) rows = [...rows].sort(sort)
    return { items: rows }
  })
  r.post(`/api/admin/${path}`, async (ctx) => {
    requireAdmin(ctx)
    const data = validate(schema, ctx.body)
    const row = { id: uid(), ...data, createdAt: now(), updatedAt: now(), deletedAt: null }
    beforeSave?.(ctx, row, null)
    ctx.db[table].push(row)
    audit(ctx, `${entity.toUpperCase()}_CREATED`, entity, row.id, { name: row.name || row.title || row.path })
    return { status: 201, data: { item: row } }
  })
  r.patch(`/api/admin/${path}/:id`, async (ctx) => {
    requireAdmin(ctx)
    const row = ctx.db[table].find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!row) throw notFound()
    const data = validate(schema.partial(), ctx.body)
    const merged = { ...row, ...data }
    beforeSave?.(ctx, merged, row)
    Object.assign(row, merged, { updatedAt: now() })
    audit(ctx, `${entity.toUpperCase()}_UPDATED`, entity, row.id, data)
    return { item: row }
  })
  r.delete(`/api/admin/${path}/:id`, async (ctx) => {
    requireAdmin(ctx)
    const row = ctx.db[table].find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!row) throw notFound()
    canDelete?.(ctx, row)
    row.deletedAt = now()
    audit(ctx, `${entity.toUpperCase()}_DELETED`, entity, row.id)
    return { ok: true }
  })
}

const inRange = (iso, days) => Date.now() - new Date(iso).getTime() < days * DAY

function dailySeries(days, rows, dateKey, valueFn = () => 1) {
  const series = Array.from({ length: days }, (_, i) => ({ date: new Date(Date.now() - (days - 1 - i) * DAY).toISOString().slice(0, 10), value: 0 }))
  const idx = new Map(series.map((s, i) => [s.date, i]))
  for (const r of rows) {
    const i = idx.get(String(r[dateKey]).slice(0, 10))
    if (i != null) series[i].value += valueFn(r)
  }
  return series
}

export default function register(r) {
  // ---- overview & analytics ---------------------------------------------------------
  r.get('/api/admin/overview', async (ctx) => {
    requireAdmin(ctx)
    const { db } = ctx
    const days = Math.min(Number(ctx.query.days) || 30, 180)
    const L = lookups(db)
    const vs = db.vehicles.filter((v) => !v.deletedAt)
    const success = db.payments.filter((p) => p.status === 'SUCCESS')
    const searches = db.analyticsEvents.filter((e) => e.type === 'SEARCH' && inRange(e.createdAt, days))
    const views = db.analyticsEvents.filter((e) => e.type === 'VEHICLE_VIEW' && inRange(e.createdAt, days))
    const tally = (rows, key) => {
      const m = {}
      for (const e of rows) if (e.meta?.[key]) m[e.meta[key]] = (m[e.meta[key]] || 0) + (e.count || 1)
      return Object.entries(m).sort((a, b) => b[1] - a[1])
    }
    const viewByVehicle = {}
    for (const e of views) viewByVehicle[e.vehicleId] = (viewByVehicle[e.vehicleId] || 0) + (e.count || 1)
    const mostViewed = Object.entries(viewByVehicle).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => {
      const v = db.vehicles.find((x) => x.id === id)
      return v ? { id, title: titleOf(db, v), slug: v.slug, views: n, price: v.price, status: v.status } : null
    }).filter(Boolean)
    const priceBands = [[0, 1e6, 'Under 1M'], [1e6, 2e6, '1M–2M'], [2e6, 5e6, '2M–5M'], [5e6, 1e7, '5M–10M'], [1e7, Infinity, '10M+']]
    const dealerPerf = db.dealers.filter((d) => !d.deletedAt).map((d) => {
      const own = vs.filter((v) => v.dealerId === d.id)
      const ids = new Set(own.map((v) => v.id))
      const ev = db.analyticsEvents.filter((e) => ids.has(e.vehicleId) && inRange(e.createdAt, days))
      const vws = ev.filter((e) => e.type === 'VEHICLE_VIEW').reduce((n, e) => n + (e.count || 1), 0)
      const leads = ev.filter((e) => ['PHONE_CLICK', 'WHATSAPP_CLICK', 'MESSAGE', 'EMAIL_CLICK'].includes(e.type)).length
      return { id: d.id, name: d.name, slug: d.slug, verified: d.verified, active: own.filter((v) => v.status === 'PUBLISHED').length, sold: own.filter((v) => v.status === 'SOLD').length, views: vws, leads, conversion: vws ? Math.round((leads / vws) * 1000) / 10 : 0 }
    }).sort((a, b) => b.views - a.views)
    const published = vs.filter((v) => v.publishedAt && inRange(v.publishedAt, days))
    return {
      days,
      kpis: {
        totalVehicles: vs.length,
        activeListings: vs.filter((v) => v.status === 'PUBLISHED').length,
        pendingApprovals: vs.filter((v) => v.status === 'PENDING_REVIEW').length,
        registeredUsers: db.users.filter((u) => !u.deletedAt).length,
        newUsers: db.users.filter((u) => !u.deletedAt && inRange(u.createdAt, days)).length,
        dealers: db.dealers.filter((d) => !d.deletedAt).length,
        messages: db.messages.filter((m) => inRange(m.createdAt, days)).length,
        revenue: success.filter((p) => inRange(p.completedAt || p.createdAt, days)).reduce((n, p) => n + p.amount, 0),
        listingSales: success.filter((p) => p.purpose !== 'DEALER_PACKAGE' && inRange(p.createdAt, days)).length,
        openReports: db.reports.filter((x) => x.status === 'OPEN').length,
        soldVehicles: vs.filter((v) => v.status === 'SOLD' && v.soldAt && inRange(v.soldAt, days)).length,
      },
      charts: {
        listings: dailySeries(days, published, 'publishedAt'),
        users: dailySeries(days, db.users.filter((u) => !u.deletedAt), 'createdAt'),
        revenue: dailySeries(days, success, 'createdAt', (p) => p.amount),
        views: dailySeries(days, views, 'createdAt', (e) => e.count || 1),
      },
      popularBrands: tally(searches, 'make').slice(0, 8).map(([slug, n]) => ({ label: db.brands.find((b) => b.slug === slug)?.name || slug, value: n })),
      popularModels: tally(searches, 'model').slice(0, 8).map(([slug, n]) => {
        const m = db.models.find((x) => x.slug === slug)
        return { label: m ? `${L.brands.get(m.brandId)?.name} ${m.name}` : slug, value: n }
      }),
      popularBodies: tally(searches, 'body').slice(0, 7).map(([slug, n]) => ({ label: db.bodyTypes.find((b) => b.slug === slug)?.name || slug, value: n })),
      popularPriceBands: priceBands.map(([lo, hi, label]) => ({ label, value: searches.filter((e) => e.meta?.maxPrice && e.meta.maxPrice > lo && e.meta.maxPrice <= hi).length })),
      mostViewed,
      dealerPerformance: dealerPerf,
      funnel: {
        created: db.analyticsEvents.filter((e) => e.type === 'LISTING_CREATED' && inRange(e.createdAt, days)).length,
        published: published.length,
        sold: vs.filter((v) => v.soldAt && inRange(v.soldAt, days)).length,
        paymentsStarted: db.payments.filter((p) => inRange(p.createdAt, days)).length,
        paymentsSucceeded: success.filter((p) => inRange(p.createdAt, days)).length,
      },
      recent: db.auditLogs.slice(0, 8).map((a) => ({ ...a, actorName: L.users.get(a.actorId)?.name || 'System' })),
    }
  })

  // ---- vehicles / listings --------------------------------------------------------------
  r.get('/api/admin/vehicles', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    const L = lookups(db)
    let rows = db.vehicles.filter((v) => !v.deletedAt)
    if (query.status && query.status !== 'ALL') rows = rows.filter((v) => v.status === query.status)
    if (query.featured === '1') rows = rows.filter((v) => v.featuredUntil && new Date(v.featuredUntil) > new Date())
    if (query.make) rows = rows.filter((v) => L.brands.get(v.brandId)?.slug === query.make)
    if (query.sellerType) rows = rows.filter((v) => v.sellerType === query.sellerType)
    if (query.q) {
      const q = query.q.toLowerCase()
      rows = rows.filter((v) => `${titleOf(db, v)} ${v.ref} ${L.users.get(v.sellerId)?.name} ${L.users.get(v.sellerId)?.email} ${L.dealers.get(v.dealerId)?.name || ''}`.toLowerCase().includes(q))
    }
    const sorts = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      price: (a, b) => b.price - a.price,
      views: (a, b) => b.views - a.views,
    }
    rows.sort(query.status === 'PENDING_REVIEW' ? (a, b) => a.updatedAt.localeCompare(b.updatedAt) : sorts[query.sort] || sorts.updated)
    const counts = db.vehicles.filter((v) => !v.deletedAt).reduce((m, v) => ({ ...m, [v.status]: (m[v.status] || 0) + 1 }), {})
    counts.ALL = Object.values(counts).reduce((a, b) => a + b, 0)
    const page = paginate(rows, query.page, Number(query.pageSize) || 25)
    return {
      ...page,
      counts,
      items: page.items.map((v) => ({
        ...toCard(v, L),
        sellerName: L.users.get(v.sellerId)?.name,
        sellerEmail: L.users.get(v.sellerId)?.email,
        dealerName: L.dealers.get(v.dealerId)?.name || null,
        sellerType: v.sellerType,
        hiddenByAdmin: v.hiddenByAdmin,
        featuredUntil: v.featuredUntil,
        reports: db.reports.filter((x) => x.vehicleId === v.id && x.status === 'OPEN').length,
        lastModeration: v.moderation?.at(-1) || null,
      })),
    }
  })

  r.get('/api/admin/vehicles/:id', async (ctx) => {
    requireAdmin(ctx)
    const v = ctx.db.vehicles.find((x) => x.id === ctx.params.id)
    if (!v) throw notFound()
    const L = lookups(ctx.db)
    return {
      vehicle: toOwnerView(v, ctx.db, L),
      moderation: (v.moderation || []).map((m) => ({ ...m, byName: L.users.get(m.byId)?.name || 'System' })).reverse(),
      reports: ctx.db.reports.filter((x) => x.vehicleId === v.id),
    }
  })

  r.post('/api/admin/vehicles/:id/moderate', async (ctx) => {
    requireAdmin(ctx)
    const v = ctx.db.vehicles.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!v) throw notFound()
    const { action, note } = ctx.body || {}
    if (action === 'delete') {
      v.deletedAt = now()
      v.status = 'ARCHIVED'
    } else applyAdminAction(ctx, v, action, note?.trim())
    audit(ctx, `LISTING_${String(action).toUpperCase()}`, 'vehicle', v.id, { note: note || null })
    return { vehicle: toOwnerView(v, ctx.db, lookups(ctx.db)) }
  })

  r.post('/api/admin/vehicles/bulk', async (ctx) => {
    requireAdmin(ctx)
    const { ids = [], action, note } = ctx.body || {}
    if (!Array.isArray(ids) || !ids.length || ids.length > 200) throw badRequest('Select between 1 and 200 listings.')
    const results = { ok: 0, failed: [] }
    for (const id of ids) {
      const v = ctx.db.vehicles.find((x) => x.id === id && !x.deletedAt)
      try {
        if (!v) throw notFound()
        if (action === 'delete') {
          v.deletedAt = now()
          v.status = 'ARCHIVED'
        } else applyAdminAction(ctx, v, action === 'pause' ? 'hide' : action, note?.trim())
        audit(ctx, `LISTING_${String(action).toUpperCase()}`, 'vehicle', id, { bulk: true })
        results.ok++
      } catch (e) {
        results.failed.push({ id, title: v ? titleOf(ctx.db, v) : id, reason: e.message })
      }
    }
    return results
  })

  r.post('/api/admin/vehicles/:id/seller', async (ctx) => {
    requireAdmin(ctx)
    const v = ctx.db.vehicles.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!v) throw notFound()
    const target = ctx.db.users.find((u) => u.id === ctx.body?.sellerId && !u.deletedAt)
    if (!target || !['PRIVATE_SELLER', 'DEALER', 'DEALER_STAFF'].includes(target.role)) throw badRequest('Choose a seller or dealer account.')
    const link = ctx.db.dealerStaff.find((s) => s.userId === target.id)
    const from = v.sellerId
    Object.assign(v, { sellerId: target.id, dealerId: link?.dealerId || null, sellerType: link ? 'DEALER' : 'PRIVATE', updatedAt: now() })
    audit(ctx, 'LISTING_SELLER_CHANGED', 'vehicle', v.id, { from, to: target.id })
    return { vehicle: toOwnerView(v, ctx.db, lookups(ctx.db)) }
  })

  // ---- users & dealers --------------------------------------------------------------
  r.get('/api/admin/users', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    let rows = db.users.filter((u) => !u.deletedAt)
    if (query.role) rows = rows.filter((u) => u.role === query.role)
    if (query.status === 'suspended') rows = rows.filter((u) => u.suspended)
    if (query.status === 'verified') rows = rows.filter((u) => u.verified)
    if (query.q) {
      const q = query.q.toLowerCase()
      rows = rows.filter((u) => `${u.name} ${u.email} ${u.phone || ''}`.toLowerCase().includes(q))
    }
    rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = paginate(rows, query.page, 25)
    return {
      ...page,
      items: page.items.map((u) => ({
        id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, verified: u.verified, suspended: u.suspended,
        createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
        listings: db.vehicles.filter((v) => v.sellerId === u.id && !v.deletedAt).length,
        dealerName: db.dealers.find((d) => d.id === db.dealerStaff.find((s) => s.userId === u.id)?.dealerId)?.name || null,
      })),
    }
  })

  r.patch('/api/admin/users/:id', async (ctx) => {
    const admin = requireAdmin(ctx)
    const { db } = ctx
    const u = db.users.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!u) throw notFound()
    if (u.id === admin.id) throw forbidden('You cannot change your own account here.')
    if (u.role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') throw forbidden('Only super admins can modify super admins.')
    const { role, suspended, verified, reason } = ctx.body || {}
    if (role !== undefined) {
      requireRole(ctx, ['SUPER_ADMIN'])
      if (!Object.values(ROLES).includes(role)) throw badRequest('Unknown role.')
      audit(ctx, 'USER_ROLE_CHANGED', 'user', u.id, { from: u.role, to: role })
      u.role = role
    }
    if (suspended !== undefined) {
      u.suspended = !!suspended
      if (u.suspended) {
        db.sessions = db.sessions.filter((s) => s.userId !== u.id)
        db.vehicles.filter((v) => v.sellerId === u.id && v.status === 'PUBLISHED').forEach((v) => Object.assign(v, { status: 'PAUSED', hiddenByAdmin: true }))
      }
      audit(ctx, suspended ? 'USER_SUSPENDED' : 'USER_REINSTATED', 'user', u.id, { reason: reason || null })
    }
    if (verified !== undefined) {
      u.verified = !!verified
      audit(ctx, verified ? 'USER_VERIFIED' : 'USER_UNVERIFIED', 'user', u.id)
      if (verified) notify(db, u.id, 'ACCOUNT', 'Your account is verified', 'Buyers will now see a verified badge on your listings.', '/account')
    }
    return { ok: true }
  })

  r.get('/api/admin/dealers', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    let rows = db.dealers.filter((d) => !d.deletedAt)
    if (query.status === 'unverified') rows = rows.filter((d) => !d.verified)
    if (query.status === 'suspended') rows = rows.filter((d) => d.suspended)
    if (query.q) rows = rows.filter((d) => `${d.name} ${d.town} ${d.email}`.toLowerCase().includes(query.q.toLowerCase()))
    return {
      items: rows.map((d) => ({
        ...d,
        ownerName: db.users.find((u) => u.id === d.ownerId)?.name,
        staff: db.dealerStaff.filter((s) => s.dealerId === d.id).length,
        active: db.vehicles.filter((v) => v.dealerId === d.id && v.status === 'PUBLISHED').length,
        total: db.vehicles.filter((v) => v.dealerId === d.id && !v.deletedAt).length,
        package: (() => {
          const p = db.purchases.find((x) => x.dealerId === d.id && new Date(x.endsAt) > new Date())
          return p ? { name: db.packages.find((k) => k.id === p.packageId)?.name, endsAt: p.endsAt } : null
        })(),
      })),
    }
  })

  r.patch('/api/admin/dealers/:id', async (ctx) => {
    requireAdmin(ctx)
    const { db } = ctx
    const d = db.dealers.find((x) => x.id === ctx.params.id && !x.deletedAt)
    if (!d) throw notFound()
    const { verified, suspended } = ctx.body || {}
    if (verified !== undefined) {
      Object.assign(d, { verified: !!verified, verifiedAt: verified ? now() : null })
      const owner = db.users.find((u) => u.id === d.ownerId)
      if (owner) owner.verified = !!verified
      audit(ctx, verified ? 'DEALER_VERIFIED' : 'DEALER_UNVERIFIED', 'dealer', d.id)
      if (verified) notify(db, d.ownerId, 'ACCOUNT', 'Your dealership is verified', 'A verified badge now appears on your storefront and listings.', `/dealer/${d.slug}`)
    }
    if (suspended !== undefined) {
      d.suspended = !!suspended
      audit(ctx, suspended ? 'DEALER_SUSPENDED' : 'DEALER_REINSTATED', 'dealer', d.id)
    }
    return { dealer: d }
  })

  // ---- reports -----------------------------------------------------------------------
  r.get('/api/admin/reports', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    const L = lookups(db)
    let rows = db.reports
    if (query.status && query.status !== 'ALL') rows = rows.filter((x) => x.status === query.status)
    return {
      items: rows.map((x) => {
        const v = db.vehicles.find((y) => y.id === x.vehicleId)
        return {
          ...x,
          vehicle: v ? { ...toCard(v, L), sellerId: v.sellerId, sellerName: L.users.get(v.sellerId)?.name, sellerSuspended: !!L.users.get(v.sellerId)?.suspended, hiddenByAdmin: v.hiddenByAdmin } : null,
          reporterName: x.reporterId ? L.users.get(x.reporterId)?.name : x.reporterEmail || 'Anonymous',
          resolvedByName: x.resolvedById ? L.users.get(x.resolvedById)?.name : null,
        }
      }),
      counts: { OPEN: db.reports.filter((x) => x.status === 'OPEN').length, ALL: db.reports.length },
    }
  })

  r.post('/api/admin/reports/:id', async (ctx) => {
    requireAdmin(ctx)
    const { db } = ctx
    const report = db.reports.find((x) => x.id === ctx.params.id)
    if (!report) throw notFound()
    const { action, note } = ctx.body || {}
    const v = db.vehicles.find((x) => x.id === report.vehicleId)
    const title = v ? titleOf(db, v) : 'your listing'
    switch (action) {
      case 'dismiss':
        report.status = 'DISMISSED'
        break
      case 'warn_seller':
        notify(db, v.sellerId, 'ACCOUNT', 'Warning about your listing', note || `We received a report about ${title}. Please make sure your listing is accurate.`, '/dashboard/listings')
        report.status = 'ACTIONED'
        break
      case 'suspend_listing':
        if (v && !['ARCHIVED', 'SOLD'].includes(v.status)) {
          Object.assign(v, { status: 'PAUSED', hiddenByAdmin: true, updatedAt: now() })
          v.moderation.push({ id: uid(), action: 'HIDDEN', status: 'PAUSED', byId: ctx.user.id, note: note || `Report: ${report.reason}`, at: now() })
          notify(db, v.sellerId, 'ACCOUNT', 'Your listing has been suspended', `${title} was suspended after a report. ${note || ''}`, '/dashboard/listings')
        }
        report.status = 'ACTIONED'
        break
      case 'suspend_seller': {
        const seller = db.users.find((u) => u.id === v?.sellerId)
        if (!seller) throw notFound('Seller not found.')
        if (['ADMIN', 'SUPER_ADMIN'].includes(seller.role)) throw forbidden()
        seller.suspended = true
        db.sessions = db.sessions.filter((s) => s.userId !== seller.id)
        db.vehicles.filter((x) => x.sellerId === seller.id && x.status === 'PUBLISHED').forEach((x) => Object.assign(x, { status: 'PAUSED', hiddenByAdmin: true }))
        audit(ctx, 'USER_SUSPENDED', 'user', seller.id, { reportId: report.id })
        report.status = 'ACTIONED'
        break
      }
      default:
        throw badRequest('Unknown action.')
    }
    Object.assign(report, { resolution: `${action}${note ? `: ${note}` : ''}`, resolvedAt: now(), resolvedById: ctx.user.id })
    // Resolve other open reports for the same listing when the listing/seller is actioned.
    if (['suspend_listing', 'suspend_seller'].includes(action)) {
      db.reports.filter((x) => x.vehicleId === report.vehicleId && x.status === 'OPEN').forEach((x) => Object.assign(x, { status: 'ACTIONED', resolution: report.resolution, resolvedAt: now(), resolvedById: ctx.user.id }))
    }
    audit(ctx, `REPORT_${action.toUpperCase()}`, 'report', report.id, { vehicleId: report.vehicleId })
    return { report }
  })

  // ---- payments ------------------------------------------------------------------------
  r.get('/api/admin/payments', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    let rows = db.payments
    if (query.status && query.status !== 'ALL') rows = rows.filter((p) => p.status === query.status)
    if (query.q) {
      const q = query.q.toLowerCase()
      rows = rows.filter((p) => `${p.reference} ${p.receipt || ''} ${db.users.find((u) => u.id === p.userId)?.email}`.toLowerCase().includes(q))
    }
    rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = paginate(rows, query.page, 25)
    const success = db.payments.filter((p) => p.status === 'SUCCESS')
    return {
      ...page,
      items: page.items.map((p) => ({ ...publicPayment(db, p), userName: db.users.find((u) => u.id === p.userId)?.name, userEmail: db.users.find((u) => u.id === p.userId)?.email, gatewayRef: p.gatewayRef })),
      summary: {
        revenue30: success.filter((p) => inRange(p.createdAt, 30)).reduce((n, p) => n + p.amount, 0),
        revenueAll: success.reduce((n, p) => n + p.amount, 0),
        failed30: db.payments.filter((p) => ['FAILED', 'CANCELLED'].includes(p.status) && inRange(p.createdAt, 30)).length,
        pending: db.payments.filter((p) => ['PENDING', 'PROCESSING'].includes(p.status)).length,
      },
    }
  })

  // ---- messages (moderation, read-only + remove) --------------------------------------
  r.get('/api/admin/conversations', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    const L = lookups(db)
    let rows = db.conversations.filter((c) => !c.deletedAt).map((c) => {
      const v = db.vehicles.find((x) => x.id === c.vehicleId)
      return { id: c.id, vehicleTitle: v ? titleOf(db, v) : '—', vehicleSlug: v?.slug, buyerName: L.users.get(c.buyerId)?.name, sellerName: L.dealers.get(c.dealerId)?.name || L.users.get(c.sellerId)?.name, lastMessageAt: c.lastMessageAt, lastMessagePreview: c.lastMessagePreview, messageCount: db.messages.filter((m) => m.conversationId === c.id).length }
    })
    if (query.q) rows = rows.filter((c) => JSON.stringify(c).toLowerCase().includes(query.q.toLowerCase()))
    rows.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
    return paginate(rows, query.page, 25)
  })

  r.get('/api/admin/conversations/:id', async (ctx) => {
    requireAdmin(ctx)
    const { db } = ctx
    const c = db.conversations.find((x) => x.id === ctx.params.id)
    if (!c) throw notFound()
    const L = lookups(db)
    audit(ctx, 'CONVERSATION_VIEWED', 'conversation', c.id)
    return { messages: db.messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((m) => ({ ...m, senderName: L.users.get(m.senderId)?.name, fromBuyer: m.senderId === c.buyerId })) }
  })

  r.delete('/api/admin/messages/:id', async (ctx) => {
    requireAdmin(ctx)
    const m = ctx.db.messages.find((x) => x.id === ctx.params.id)
    if (!m) throw notFound()
    m.deletedAt = now()
    audit(ctx, 'MESSAGE_REMOVED', 'message', m.id)
    return { ok: true }
  })

  // ---- taxonomy ------------------------------------------------------------------------
  const ensureUniqueSlug = (table, label) => (ctx, row, existing) => {
    row.slug = slugify(row.name)
    const clash = ctx.db[table].find((x) => x.slug === row.slug && x.id !== existing?.id && !x.deletedAt && (table !== 'models' || x.brandId === row.brandId))
    if (clash) throw new ApiError(409, 'CONFLICT', `${label} “${row.name}” already exists.`, { name: 'Already exists' })
  }
  crud(r, 'brands', 'brands', brandSchema, {
    entity: 'brand', beforeSave: ensureUniqueSlug('brands', 'Brand'), sort: (a, b) => a.name.localeCompare(b.name),
    canDelete: (ctx, row) => {
      if (ctx.db.vehicles.some((v) => v.brandId === row.id && !v.deletedAt)) throw conflict('This brand has vehicles. Deactivate it instead of deleting.')
    },
  })
  crud(r, 'models', 'models', modelSchema, {
    entity: 'model', sort: (a, b) => a.name.localeCompare(b.name),
    beforeSave: (ctx, row, existing) => {
      if (!ctx.db.brands.some((b) => b.id === row.brandId)) throw badRequest('Unknown brand.')
      ensureUniqueSlug('models', 'Model')(ctx, row, existing)
    },
    canDelete: (ctx, row) => {
      if (ctx.db.vehicles.some((v) => v.modelId === row.id && !v.deletedAt)) throw conflict('This model has vehicles. Deactivate it instead of deleting.')
    },
  })
  crud(r, 'body-types', 'bodyTypes', bodyTypeSchema, {
    entity: 'body_type', sort: (a, b) => (a.sort ?? 99) - (b.sort ?? 99),
    beforeSave: (ctx, row, existing) => {
      ensureUniqueSlug('bodyTypes', 'Body type')(ctx, row, existing)
      row.plural = row.plural || `${row.name}s`
    },
    canDelete: (ctx, row) => {
      if (ctx.db.vehicles.some((v) => v.bodyTypeId === row.id && !v.deletedAt)) throw conflict('Vehicles use this body type.')
    },
  })
  crud(r, 'packages', 'packages', packageSchema, { entity: 'package', sort: (a, b) => (a.sort ?? 99) - (b.sort ?? 99) })
  crud(r, 'promotions', 'promotions', promotionSchema, {
    entity: 'promotion', sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
    beforeSave: (ctx, row) => {
      if (row.vehicleId && !ctx.db.vehicles.some((v) => v.id === row.vehicleId && v.status === 'PUBLISHED')) throw new ApiError(422, 'VALIDATION_FAILED', 'Vehicle must be a published listing.', { vehicleId: 'Choose a published listing' })
      if (row.endsAt <= row.startsAt) throw new ApiError(422, 'VALIDATION_FAILED', 'End date must be after start date.', { endsAt: 'Must be after start date' })
    },
  })
  crud(r, 'pages', 'cmsPages', cmsPageSchema, {
    entity: 'cms_page', sort: (a, b) => a.slug.localeCompare(b.slug),
    beforeSave: (ctx, row, existing) => {
      if (ctx.db.cmsPages.some((p) => p.slug === row.slug && p.id !== existing?.id && !p.deletedAt)) throw new ApiError(409, 'CONFLICT', 'A page with this slug exists.', { slug: 'Slug already in use' })
    },
  })
  crud(r, 'seo', 'seoRecords', seoRecordSchema, {
    entity: 'seo_record', sort: (a, b) => a.path.localeCompare(b.path),
    beforeSave: (ctx, row, existing) => {
      if (ctx.db.seoRecords.some((p) => p.path === row.path && p.id !== existing?.id && !p.deletedAt)) throw new ApiError(409, 'CONFLICT', 'An SEO record for this path exists.', { path: 'Path already has a record' })
    },
  })

  // ---- settings, homepage, logs ----------------------------------------------------------
  r.get('/api/admin/settings', async (ctx) => {
    requireAdmin(ctx)
    return { settings: ctx.db.settings }
  })

  r.patch('/api/admin/settings', async (ctx) => {
    requireAdmin(ctx)
    const s = ctx.db.settings
    const b = ctx.body || {}
    const bool = (v, d) => (typeof v === 'boolean' ? v : d)
    const int = (v, d, min, max) => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : d)
    s.moderationRequired = bool(b.moderationRequired, s.moderationRequired)
    s.autoApproveVerifiedDealers = bool(b.autoApproveVerifiedDealers, s.autoApproveVerifiedDealers)
    s.maintenanceMode = bool(b.maintenanceMode, s.maintenanceMode)
    s.privateFreeListings = int(b.privateFreeListings, s.privateFreeListings, 0, 100)
    s.dealerFreeListings = int(b.dealerFreeListings, s.dealerFreeListings, 0, 1000)
    s.listingDurationDays = int(b.listingDurationDays, s.listingDurationDays, 7, 365)
    if (b.payments) s.payments = { MPESA: bool(b.payments.MPESA, s.payments.MPESA), CARD: bool(b.payments.CARD, s.payments.CARD), BANK: bool(b.payments.BANK, s.payments.BANK) }
    if (b.homepage) {
      const h = b.homepage
      const clean = (x, max) => String(x ?? '').replace(/<[^>]*>/g, '').slice(0, max)
      s.homepage = {
        heroTitle: clean(h.heroTitle ?? s.homepage.heroTitle, 80) || 'Find your next car',
        heroSubtitle: clean(h.heroSubtitle ?? s.homepage.heroSubtitle, 200),
        announcement: clean(h.announcement ?? s.homepage.announcement, 200),
        popularSearches: Array.isArray(h.popularSearches)
          ? h.popularSearches.filter((p) => p.label && /^\/[\w\-/?=&.%]*$/.test(p.href)).slice(0, 16).map((p) => ({ label: clean(p.label, 40), href: p.href }))
          : s.homepage.popularSearches,
      }
    }
    audit(ctx, 'SETTINGS_UPDATED', 'settings', null, Object.keys(b))
    return { settings: s }
  })

  r.get('/api/admin/audit-logs', async (ctx) => {
    requireAdmin(ctx)
    const { db, query } = ctx
    const L = lookups(db)
    let rows = db.auditLogs
    if (query.action) rows = rows.filter((a) => a.action.includes(query.action.toUpperCase()))
    if (query.entity) rows = rows.filter((a) => a.entityType === query.entity)
    if (query.q) {
      const q = query.q.toLowerCase()
      rows = rows.filter((a) => `${a.action} ${L.users.get(a.actorId)?.name || ''} ${a.entityId || ''}`.toLowerCase().includes(q))
    }
    const page = paginate(rows, query.page, 50)
    return { ...page, items: page.items.map((a) => ({ ...a, actorName: L.users.get(a.actorId)?.name || 'System', actorEmail: L.users.get(a.actorId)?.email })) }
  })

  r.get('/api/admin/outbox', async (ctx) => {
    requireAdmin(ctx)
    return paginate(ctx.db.outbox, ctx.query.page, 50)
  })

  r.get('/api/admin/contact-messages', async (ctx) => {
    requireAdmin(ctx)
    return { items: ctx.db.contactMessages }
  })

  r.get('/api/admin/sellers', async (ctx) => {
    requireAdmin(ctx)
    const q = (ctx.query.q || '').toLowerCase()
    return {
      items: ctx.db.users
        .filter((u) => !u.deletedAt && ['PRIVATE_SELLER', 'DEALER', 'DEALER_STAFF'].includes(u.role) && `${u.name} ${u.email}`.toLowerCase().includes(q))
        .slice(0, 20)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    }
  })

  r.get('/api/admin/vehicles-lookup', async (ctx) => {
    requireAdmin(ctx)
    const L = lookups(ctx.db)
    const q = (ctx.query.q || '').toLowerCase()
    return {
      items: ctx.db.vehicles
        .filter((v) => v.status === 'PUBLISHED' && !v.deletedAt)
        .map((v) => toCard(v, L))
        .filter((c) => `${c.title} ${c.ref}`.toLowerCase().includes(q))
        .slice(0, 15)
        .map((c) => ({ id: c.id, title: c.title, ref: c.ref, price: c.price })),
    }
  })
}

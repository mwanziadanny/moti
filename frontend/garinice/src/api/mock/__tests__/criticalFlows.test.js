// End-to-end API journeys from the build spec (§49), run against the mock backend
// which implements the production REST contract.
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApi } from '../../../test/mockApi'
import { signWebhook } from '../handlers/payments'

let api
const TINY_WEBP = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA='

async function validListing(call, token, overrides = {}) {
  const tax = (await call('GET', '/api/taxonomy')).data
  const toyota = tax.brands.find((b) => b.slug === 'toyota')
  const prado = tax.models.find((m) => m.slug === 'land-cruiser-prado' && m.brandId === toyota.id)
  const up = await call('POST', '/api/uploads', { token, body: { kind: 'image', dataUrl: TINY_WEBP, width: 1200, height: 900 } })
  expect(up.status).toBe(201)
  return {
    sellerType: 'PRIVATE', brandId: toyota.id, modelId: prado.id, variant: 'TX-L', year: 2018,
    bodyTypeId: tax.bodyTypes.find((b) => b.slug === 'suv').id, condition: 'FOREIGN_USED', importStatus: 'LOCAL',
    engineCc: 2800, fuelTypeId: tax.fuelTypes.find((f) => f.slug === 'diesel').id,
    transmissionId: tax.transmissions.find((t) => t.slug === 'automatic').id, driveType: '4WD', mileageKm: 68000,
    features: ['abs', 'reverse-camera', 'not-a-real-feature'], price: 7_450_000, negotiable: true,
    county: 'Nairobi', town: 'Nairobi', area: 'Kilimani',
    images: [{ id: up.data.id, url: 'https://evil.example/hotlink.jpg' }],
    description: 'Very clean Prado TX-L, diesel, sunroof, leather. Accident free and well maintained by one owner.',
    contact: { inApp: true, phone: true, whatsapp: false, email: false, phoneNumber: '0712345678' },
    ...overrides,
  }
}

describe('critical marketplace journeys', () => {
  beforeAll(async () => {
    api = await createTestApi()
  })

  it('1–2. visitor searches "Toyota Prado" (with typo tolerance) and opens a vehicle', async () => {
    const { call } = api
    const res = await call('GET', '/api/vehicles', { query: { q: 'toyota prado', facets: '1' } })
    expect(res.status).toBe(200)
    expect(res.data.total).toBeGreaterThan(0)
    expect(res.data.items.every((v) => v.make === 'Toyota' && v.model.includes('Prado'))).toBe(true)
    expect(res.data.facets.make.toyota).toBeGreaterThan(0)

    const typo = await call('GET', '/api/vehicles', { query: { q: 'toyta prdo' } })
    expect(typo.data.total).toBe(res.data.total)

    const filtered = await call('GET', '/api/vehicles', { query: { make: 'toyota', model: 'land-cruiser-prado', minPrice: '2000000', maxPrice: '50000000', sort: 'price_asc' } })
    const prices = filtered.data.items.map((v) => v.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    const detail = await call('GET', `/api/vehicles/${res.data.items[0].slug}`)
    expect(detail.status).toBe(200)
    expect(detail.data.vehicle.title).toMatch(/Toyota Land Cruiser Prado/)
    expect(detail.data.vehicle.sellerEmail).toBeUndefined()
  })

  it('3–4. visitor registers and saves a vehicle; saving requires auth', async () => {
    const { call } = api
    const anon = await call('POST', '/api/favourites', { body: { vehicleId: 'x' } })
    expect(anon.status).toBe(401)

    const bad = await call('POST', '/api/auth/register', { body: { name: 'A', email: 'nope', password: 'short', confirmPassword: 'x', accountType: 'BUYER', acceptTerms: true } })
    expect(bad.status).toBe(422)
    expect(bad.error.fieldErrors.email).toBeTruthy()

    const reg = await call('POST', '/api/auth/register', { body: { name: 'Test Buyer', email: 'New.Buyer@Example.com', phone: '0722000111', password: 'Secret123', confirmPassword: 'Secret123', accountType: 'BUYER', acceptTerms: true } })
    expect(reg.status).toBe(201)
    expect(reg.data.user.email).toBe('new.buyer@example.com')
    const token = reg.data.token

    const dup = await call('POST', '/api/auth/register', { body: { name: 'Again', email: 'new.buyer@example.com', password: 'Secret123', confirmPassword: 'Secret123', accountType: 'BUYER', acceptTerms: true } })
    expect(dup.status).toBe(409)

    const { items } = (await call('GET', '/api/vehicles')).data
    expect((await call('POST', '/api/favourites', { token, body: { vehicleId: items[0].id } })).status).toBe(201)
    expect((await call('POST', '/api/favourites', { token, body: { vehicleId: items[0].id } })).status).toBe(201) // idempotent
    const ids = await call('GET', '/api/favourites/ids', { token })
    expect(ids.data.ids).toEqual([items[0].id])
  })

  it('5–6. buyer messages seller; seller receives message and notification', async () => {
    const { call, login, db } = api
    const buyer = await login('buyer@example.com')
    const v = db.vehicles.find((x) => x.status === 'PUBLISHED' && x.sellerType === 'PRIVATE' && x.contact.inApp)
    const seller = db.users.find((u) => u.id === v.sellerId)
    const start = await call('POST', '/api/conversations', { token: buyer, body: { vehicleId: v.id, body: 'Hi, is it still available?' } })
    expect(start.status).toBe(201)

    const sellerToken = await login(seller.email)
    const inbox = await call('GET', '/api/conversations', { token: sellerToken, query: { side: 'selling' } })
    const convo = inbox.data.items.find((c) => c.id === start.data.conversationId)
    expect(convo.unread).toBeGreaterThanOrEqual(1)
    const thread = await call('GET', `/api/conversations/${convo.id}`, { token: sellerToken })
    expect(thread.data.messages.at(-1).body).toBe('Hi, is it still available?')
    const notes = await call('GET', '/api/notifications', { token: sellerToken })
    expect(notes.data.items.some((n) => n.type === 'NEW_ENQUIRY')).toBe(true)
    expect(db.outbox.some((o) => o.userId === seller.id && o.channel === 'EMAIL')).toBe(true)

    // A third party cannot read the conversation
    const other = await login('otieno@example.com')
    expect((await call('GET', `/api/conversations/${convo.id}`, { token: other })).status).toBe(403)
  })

  it('7–9. seller creates listing → admin approves → publicly searchable', async () => {
    const { call, login, db } = api
    const token = await login('njeri@example.com')
    // Free quota is enforced; give room for this test.
    db.settings.privateFreeListings = 50

    const missing = await call('POST', '/api/vehicles', { token, body: { data: { price: 10 }, submit: true } })
    expect(missing.status).toBe(422)

    const data = await validListing(call, token)
    const created = await call('POST', '/api/vehicles', { token, body: { data, submit: true } })
    expect(created.status).toBe(201)
    expect(created.data.status).toBe('PENDING_REVIEW')
    const vehicle = created.data.vehicle
    expect(vehicle.images[0].url).toBe(TINY_WEBP) // server ignores client-supplied URL
    expect(vehicle.rawFeatures).not.toContain('not-a-real-feature')
    expect(vehicle.slug).toMatch(/^2018-toyota-land-cruiser-prado-tx-l-[a-z0-9]{8}$/)

    // Not public yet
    expect((await call('GET', `/api/vehicles/${vehicle.slug}`)).status).toBe(404)
    const seller = await call('POST', `/api/admin/vehicles/${vehicle.id}/moderate`, { token, body: { action: 'approve' } })
    expect(seller.status).toBe(403)

    const admin = await login('moderator@garinice.co.ke')
    const rej = await call('POST', `/api/admin/vehicles/${vehicle.id}/moderate`, { token: admin, body: { action: 'reject' } })
    expect(rej.status).toBe(422) // reason required
    const ok = await call('POST', `/api/admin/vehicles/${vehicle.id}/moderate`, { token: admin, body: { action: 'approve' } })
    expect(ok.status).toBe(200)

    const pub = await call('GET', '/api/vehicles', { query: { q: vehicle.ref } })
    expect(pub.data.items.map((x) => x.id)).toContain(vehicle.id)
    const history = await call('GET', `/api/admin/vehicles/${vehicle.id}`, { token: admin })
    expect(history.data.moderation.map((m) => m.action)).toEqual(['APPROVED', 'SUBMITTED'])
    expect(db.auditLogs.some((a) => a.action === 'LISTING_APPROVE' && a.entityId === vehicle.id)).toBe(true)
  })

  it('agent listings require an Authority to Sell document; buyers cannot claim dealer', async () => {
    const { call, login } = api
    const token = await login('mutua@example.com')
    const data = await validListing(call, token, { sellerType: 'AGENT' })
    const res = await call('POST', '/api/vehicles', { token, body: { data, submit: true } })
    expect(res.status).toBe(422)
    expect(res.error.fieldErrors.authorityDocUrl).toBeTruthy()

    const asDealer = await call('POST', '/api/vehicles', { token, body: { data: { ...data, sellerType: 'DEALER' }, submit: false } })
    expect(asDealer.status).toBe(422)
  })

  it('10–12. seller buys a package; signed webhook is processed once; forged/duplicate webhooks are rejected', async () => {
    const { call, login, db } = api
    const token = await login('wanjiku@example.com')
    const v = db.vehicles.find((x) => x.sellerId === db.users.find((u) => u.email === 'wanjiku@example.com').id && x.status === 'PUBLISHED')
    const pkg = db.packages.find((p) => p.name === 'Featured Listing')
    const body = { packageId: pkg.id, vehicleId: v.id, method: 'MPESA', phone: '0712345678', idempotencyKey: 'test-key-123456', amount: 1 }
    const init = await call('POST', '/api/payments', { token, body })
    expect(init.status).toBe(201)
    expect(init.data.payment.amount).toBe(3500) // client "amount" ignored
    expect(init.data.payment.status).toBe('PROCESSING')

    const again = await call('POST', '/api/payments', { token, body })
    expect(again.data.payment.id).toBe(init.data.payment.id) // idempotent

    const payment = db.payments.find((p) => p.id === init.data.payment.id)
    const payload = { eventId: 'evt_1', checkoutRequestId: payment.gatewayRef, resultCode: 0, resultDesc: 'ok', amount: 3500, receipt: 'TXYZ123', phone: payment.phone }

    const forged = await call('POST', '/api/payments/webhook', { body: payload, headers: { 'x-gateway-signature': 'deadbeef' } })
    expect(forged.status).toBe(401)
    expect(db.payments.find((p) => p.id === payment.id).status).toBe('PROCESSING')

    const sig = await signWebhook(payload)
    const first = await call('POST', '/api/payments/webhook', { body: payload, headers: { 'x-gateway-signature': sig } })
    expect(first.data.ok).toBe(true)
    const after = await call('GET', `/api/payments/${payment.id}`, { token })
    expect(after.data.payment.status).toBe('SUCCESS')
    expect(db.vehicles.find((x) => x.id === v.id).featuredUntil).toBeTruthy()
    const purchases = db.purchases.filter((p) => p.paymentId === payment.id).length

    const dup = await call('POST', '/api/payments/webhook', { body: payload, headers: { 'x-gateway-signature': sig } })
    expect(dup.data.duplicate).toBe(true)
    const replay = { ...payload, eventId: 'evt_2' }
    const dup2 = await call('POST', '/api/payments/webhook', { body: replay, headers: { 'x-gateway-signature': await signWebhook(replay) } })
    expect(dup2.data.duplicate).toBe(true)
    expect(db.purchases.filter((p) => p.paymentId === payment.id).length).toBe(purchases)
  })

  it('webhook with mismatched amount fails the payment', async () => {
    const { call, login, db } = api
    const token = await login('hassan@example.com')
    const v = db.vehicles.find((x) => x.sellerId === db.users.find((u) => u.email === 'hassan@example.com').id && x.status === 'PUBLISHED')
    const pkg = db.packages.find((p) => p.name === 'Premium Listing')
    const init = await call('POST', '/api/payments', { token, body: { packageId: pkg.id, vehicleId: v.id, method: 'MPESA', phone: '0712345679', idempotencyKey: 'mismatch-key-1' } })
    const p = db.payments.find((x) => x.id === init.data.payment.id)
    const payload = { eventId: 'evt_mm', checkoutRequestId: p.gatewayRef, resultCode: 0, amount: 1, receipt: 'R1' }
    await call('POST', '/api/payments/webhook', { body: payload, headers: { 'x-gateway-signature': await signWebhook(payload) } })
    expect(p.status).toBe('FAILED')
  })

  it('13–14. seller marks vehicle sold → disappears from active inventory', async () => {
    const { call, login, db } = api
    const token = await login('kiprono@example.com')
    const sellerId = db.users.find((u) => u.email === 'kiprono@example.com').id
    const v = db.vehicles.find((x) => x.sellerId === sellerId && x.status === 'PUBLISHED')
    const res = await call('POST', `/api/vehicles/${v.id}/status`, { token, body: { action: 'mark_sold' } })
    expect(res.data.status).toBe('SOLD')
    const active = await call('GET', '/api/vehicles', { query: { q: v.ref } })
    expect(active.data.items.find((x) => x.id === v.id)).toBeUndefined()
    const all = await call('GET', '/api/vehicles', { query: { q: v.ref, availability: 'all' } })
    expect(all.data.items.find((x) => x.id === v.id)?.status).toBe('SOLD')
    const again = await call('POST', `/api/vehicles/${v.id}/status`, { token, body: { action: 'mark_sold' } })
    expect(again.status).toBe(409)
  })
})

describe('authorization (RBAC)', () => {
  beforeAll(async () => {
    api = await createTestApi({ vehicleCount: 40 })
  })

  it('blocks non-admins from admin endpoints and other sellers’ listings', async () => {
    const { call, login, db } = api
    const buyer = await login('buyer@example.com')
    expect((await call('GET', '/api/admin/overview', { token: buyer })).status).toBe(403)
    expect((await call('GET', '/api/admin/overview')).status).toBe(401)
    const someone = db.vehicles.find((v) => v.status === 'PUBLISHED')
    const attacker = await login('otieno@example.com')
    if (someone.sellerId !== db.users.find((u) => u.email === 'otieno@example.com').id) {
      expect((await call('PATCH', `/api/vehicles/${someone.id}`, { token: attacker, body: { data: { price: 100000 } } })).status).toBe(403)
      expect((await call('DELETE', `/api/vehicles/${someone.id}`, { token: attacker })).status).toBe(403)
    }
  })

  it('only super admins can change roles; suspended users cannot sign in', async () => {
    const { call, login, db } = api
    const mod = await login('moderator@garinice.co.ke')
    const target = db.users.find((u) => u.email === 'otieno@example.com')
    expect((await call('PATCH', `/api/admin/users/${target.id}`, { token: mod, body: { role: 'ADMIN' } })).status).toBe(403)
    expect((await call('PATCH', `/api/admin/users/${target.id}`, { token: mod, body: { suspended: true } })).status).toBe(200)
    const res = await call('POST', '/api/auth/login', { body: { email: 'otieno@example.com', password: 'Password123!' } })
    expect(res.status).toBe(403)
    expect(res.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('dealer staff can manage dealer inventory but not edit the storefront', async () => {
    const { call, login, db } = api
    const staff = await login('staff@axismotors.co.ke')
    const dealer = db.dealers.find((d) => d.slug === 'axis-motors')
    const v = db.vehicles.find((x) => x.dealerId === dealer.id && x.status === 'PUBLISHED')
    if (v) expect((await call('POST', `/api/vehicles/${v.id}/status`, { token: staff, body: { action: 'pause' } })).status).toBe(200)
    expect((await call('PATCH', '/api/dealer', { token: staff, body: { name: 'Hacked' } })).status).toBe(403)
  })

  it('rate limits login attempts', async () => {
    const { call } = api
    let last
    for (let i = 0; i < 12; i++) last = await call('POST', '/api/auth/login', { body: { email: 'x@example.com', password: 'wrong' } })
    expect(last.status).toBe(429)
  })
})

describe('reports', () => {
  beforeAll(async () => {
    api = await createTestApi({ vehicleCount: 40 })
  })

  it('anyone can report; admin can suspend the listing', async () => {
    const { call, login, db } = api
    const v = db.vehicles.find((x) => x.status === 'PUBLISHED')
    const r = await call('POST', '/api/reports', { body: { vehicleId: v.id, reason: 'FRAUD', details: '<b>asked</b> for deposit' } })
    expect(r.status).toBe(201)
    expect(db.reports.find((x) => x.id === r.data.id).details).toBe('asked for deposit')
    const again = await call('POST', '/api/reports', { body: { vehicleId: v.id, reason: 'FRAUD' } })
    expect(again.status).toBe(409)
    const admin = await login('admin@garinice.co.ke')
    await call('POST', `/api/admin/reports/${r.data.id}`, { token: admin, body: { action: 'suspend_listing', note: 'Fraud' } })
    expect(v.status).toBe('PAUSED')
    expect(v.hiddenByAdmin).toBe(true)
    // Seller cannot un-hide it themselves
    const seller = db.users.find((u) => u.id === v.sellerId)
    const st = await login(seller.email)
    expect((await call('POST', `/api/vehicles/${v.id}/status`, { token: st, body: { action: 'resume' } })).status).toBe(403)
  })
})

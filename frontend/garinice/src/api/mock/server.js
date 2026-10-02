// The mock backend: same REST contract the production API implements.
import { sha256 } from './crypto'
import { clearPersisted, loadPersisted, persist, SCHEMA_VERSION } from './db'
import { ApiError, createRouter, isAdmin, requireRole, audit } from './http'
import { runScheduledJobs } from './listingService'
import { createSeed } from './seed'
import registerAdmin from './handlers/admin'
import registerAuth from './handlers/auth'
import registerCatalog from './handlers/catalog'
import registerPayments from './handlers/payments'
import registerSeller from './handlers/seller'
import registerSocial from './handlers/social'

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export function createMockServer(db, options = {}) {
  const router = createRouter()
  registerAuth(router)
  registerCatalog(router)
  registerSeller(router)
  registerSocial(router)
  registerPayments(router)
  registerAdmin(router)

  const server = {
    db,
    options,
    async reset() {
      server.db = await createSeed()
      await clearPersisted()
      if (options.persist !== false) await persist(server.db, { immediate: true })
    },
    async handle({ method = 'GET', path, query = {}, body, headers = {}, internal = false }) {
      const db = server.db
      const ctx = { db, query, body, headers, params: {}, user: null, session: null, ip: headers['x-forwarded-for'] || 'browser', visitorId: headers['x-visitor-id'], server, internalOptions: options }
      try {
        const auth = headers.authorization || headers.Authorization
        if (auth?.startsWith('Bearer ')) {
          const hash = await sha256(auth.slice(7))
          const session = db.sessions.find((s) => s.tokenHash === hash)
          if (session && new Date(session.expiresAt) > new Date()) {
            const user = db.users.find((u) => u.id === session.userId && !u.deletedAt && !u.suspended)
            if (user) {
              ctx.user = user
              ctx.session = session
            }
          }
        }
        runScheduledJobs(db)
        if (db.settings.maintenanceMode && !isAdmin(ctx.user) && !path.startsWith('/api/auth') && !internal) {
          throw new ApiError(503, 'MAINTENANCE', 'GariNice is undergoing scheduled maintenance. Please check back shortly.')
        }
        if (path === '/api/admin/reset-demo' && method === 'POST') {
          requireRole(ctx, ['SUPER_ADMIN'])
          await server.reset()
          ctx.db = server.db
          audit(ctx, 'DEMO_DATA_RESET', 'system', null)
          return { status: 200, data: { ok: true } }
        }
        const match = router.match(method, path)
        if (!match) throw new ApiError(404, 'NOT_FOUND', `No route for ${method} ${path}`)
        ctx.params = match.params
        const result = await match.handler(ctx)
        if (MUTATING.has(method) && options.persist !== false) persist(db)
        if (result && typeof result === 'object' && 'status' in result && 'data' in result) return result
        return { status: 200, data: result }
      } catch (err) {
        if (err instanceof ApiError) {
          return { status: err.status, error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }
        }
        console.error('[mock-api]', method, path, err)
        return { status: 500, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }
      }
    },
  }
  return server
}

let instance = null
let booting = null

export function getMockServer() {
  if (instance) return Promise.resolve(instance)
  if (!booting) {
    booting = (async () => {
      let db = await loadPersisted()
      if (!db || db.version !== SCHEMA_VERSION) {
        db = await createSeed()
        await persist(db, { immediate: true })
      }
      instance = createMockServer(db)
      return instance
    })()
  }
  return booting
}

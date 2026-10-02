// Test harness: a fresh, isolated mock backend per test file.
import { resetRateLimits } from '../api/mock/http'
import { createMockServer } from '../api/mock/server'
import { createSeed, DEMO_PASSWORD } from '../api/mock/seed'

export { DEMO_PASSWORD }

export async function createTestApi({ vehicleCount = 80 } = {}) {
  resetRateLimits()
  const db = await createSeed({ vehicleCount })
  const server = createMockServer(db, { persist: false, manualGateway: true, gatewayDelayMs: 0 })

  async function call(method, path, { body, query, token, headers = {} } = {}) {
    const res = await server.handle({
      method, path, query: query || {}, body,
      headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-visitor-id': headers['x-visitor-id'] || 'test-visitor' },
    })
    return res
  }

  async function login(email, password = DEMO_PASSWORD) {
    const res = await call('POST', '/api/auth/login', { body: { email, password } })
    if (res.error) throw new Error(`login failed for ${email}: ${res.error.message}`)
    return res.data.token
  }

  return { server, db, call, login }
}

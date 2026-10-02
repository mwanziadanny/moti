// HTTP client. With VITE_API_URL set it talks to the real backend (cookie session +
// CSRF header). Without it, requests are served by the in-browser mock backend, which
// implements the identical REST contract.

const API_URL = import.meta.env.VITE_API_URL || ''
const IS_TEST = import.meta.env.MODE === 'test'
const TOKEN_KEY = 'gn_session'
const VISITOR_KEY = 'gn_vid'

export const usingMockApi = !API_URL

export class ApiClientError extends Error {
  constructor({ status, code, message, fieldErrors }) {
    super(message || 'Request failed')
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors || null
  }
  get isNetwork() {
    return this.status === 0
  }
}

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      /* storage unavailable */
    }
  },
}

let memoryToken = null
export const getToken = () => memoryToken ?? storage.get(TOKEN_KEY)
export function setToken(token) {
  memoryToken = token
  storage.set(TOKEN_KEY, token)
}

function visitorId() {
  let id = storage.get(VISITOR_KEY)
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2)
    storage.set(VISITOR_KEY, id)
  }
  return id
}

function cleanQuery(query = {}) {
  const out = {}
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue
    out[k] = Array.isArray(v) ? v.join(',') : String(v)
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function mockRequest(method, path, { query, body }) {
  const { getMockServer } = await import('./mock/server')
  const server = await getMockServer()
  if (!IS_TEST) await sleep(90 + Math.random() * 180)
  const headers = { 'x-visitor-id': visitorId() }
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`
  // Deep-clone to mimic serialization across the network boundary.
  const res = await server.handle({ method, path, query: cleanQuery(query), body: body == null ? undefined : JSON.parse(JSON.stringify(body)), headers })
  if (res.error) throw new ApiClientError({ status: res.status, ...res.error })
  return JSON.parse(JSON.stringify(res.data ?? null))
}

function csrfToken() {
  const m = document.cookie.match(/(?:^|; )gn_csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

async function httpRequest(method, path, { query, body, signal }) {
  const qs = new URLSearchParams(cleanQuery(query)).toString()
  let res
  try {
    res = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ''}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken() } : {}),
        'X-Visitor-Id': visitorId(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiClientError({ status: 0, code: 'NETWORK', message: 'We couldn’t reach the server. Check your internet connection and try again.' })
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiClientError({ status: res.status, code: data?.error?.code || 'HTTP_ERROR', message: data?.error?.message || res.statusText, fieldErrors: data?.error?.fieldErrors })
  }
  return data
}

export async function request(method, path, opts = {}) {
  if (!IS_TEST && typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiClientError({ status: 0, code: 'NETWORK', message: 'You appear to be offline. Reconnect and try again.' })
  }
  return usingMockApi ? mockRequest(method, path, opts) : httpRequest(method, path, opts)
}

export const http = {
  get: (path, query, opts) => request('GET', path, { ...opts, query }),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  delete: (path, body, opts) => request('DELETE', path, { ...opts, body }),
}

// In-browser relational-style store used while the real backend is built.
// Tables mirror the production schema (see docs/DATABASE.md). Persisted to IndexedDB
// so demo data survives reloads; falls back to memory (tests, private browsing).

export const SCHEMA_VERSION = 3

export const TABLES = [
  'users', 'profiles', 'sessions', 'passwordResets', 'dealers', 'dealerStaff',
  'brands', 'models', 'bodyTypes', 'fuelTypes', 'transmissions', 'locations', 'features',
  'vehicles', 'favourites', 'conversations', 'messages', 'reports',
  'packages', 'purchases', 'payments', 'webhookEvents', 'promotions',
  'analyticsEvents', 'notifications', 'outbox', 'auditLogs', 'cmsPages', 'seoRecords',
  'contactMessages', 'uploads',
]

export function emptyDb() {
  const db = { version: SCHEMA_VERSION, settings: {} }
  for (const t of TABLES) db[t] = []
  return db
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

export const now = () => new Date().toISOString()

export function shortRef(prefix, len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  const bytes = new Uint8Array(len)
  globalThis.crypto.getRandomValues(bytes)
  for (const b of bytes) s += alphabet[b % alphabet.length]
  return `${prefix}-${s}`
}

// ---- persistence -----------------------------------------------------------------
const IDB_NAME = 'garinice-mock'
const IDB_STORE = 'kv'
const IDB_KEY = 'db'

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexeddb'))
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadPersisted() {
  try {
    const idb = await openIdb()
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

let saveTimer = null
export function persist(db, { immediate = false } = {}) {
  if (typeof indexedDB === 'undefined') return Promise.resolve()
  clearTimeout(saveTimer)
  const write = async () => {
    try {
      const idb = await openIdb()
      await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).put(db, IDB_KEY)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('[mock-db] persist failed', err)
    }
  }
  if (immediate) return write()
  return new Promise((resolve) => {
    saveTimer = setTimeout(() => write().then(resolve), 250)
  })
}

export async function clearPersisted() {
  try {
    const idb = await openIdb()
    await new Promise((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(IDB_KEY)
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  } catch {
    /* ignore */
  }
}

// ---- small query helpers -----------------------------------------------------------
export const byId = (table, id) => table.find((r) => r.id === id && !r.deletedAt)
export const alive = (rows) => rows.filter((r) => !r.deletedAt)

export function paginate(rows, page = 1, pageSize = 20) {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const total = rows.length
  return {
    items: rows.slice((p - 1) * size, p * size),
    total,
    page: p,
    pageSize: size,
    pageCount: Math.max(1, Math.ceil(total / size)),
  }
}

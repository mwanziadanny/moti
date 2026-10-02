import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { parseFilters, toSearchParams } from '../lib/filters'

export function useDebounce(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Inventory filters, synced to the URL. `base` are filters implied by the route
 * (e.g. /cars/toyota → make=toyota); changing a base filter moves to /cars?….
 */
export function useFilters(base = {}) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const baseKey = JSON.stringify(base)
  const filters = useMemo(() => parseFilters(params, JSON.parse(baseKey)), [params, baseKey])

  const setFilters = useCallback(
    (next, { replace = false } = {}) => {
      const resolved = typeof next === 'function' ? next(filters) : next
      const baseObj = JSON.parse(baseKey)
      const keepsBase = Object.entries(baseObj).every(([k, v]) => String(resolved[k] ?? '') === String(v))
      const path = keepsBase ? pathname : '/cars'
      const qs = toSearchParams(resolved, keepsBase ? baseObj : {}).toString()
      navigate(`${path}${qs ? `?${qs}` : ''}`, { replace, preventScrollReset: true })
    },
    [filters, baseKey, pathname, navigate],
  )

  const update = useCallback((patch, opts) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? undefined }), opts), [setFilters])
  return { filters, setFilters, update }
}

export function useOnClickOutside(ref, handler, active = true) {
  const saved = useRef(handler)
  useEffect(() => {
    saved.current = handler
  })
  useEffect(() => {
    if (!active) return
    const fn = (e) => !ref.current?.contains(e.target) && saved.current(e)
    document.addEventListener('mousedown', fn)
    document.addEventListener('touchstart', fn)
    return () => {
      document.removeEventListener('mousedown', fn)
      document.removeEventListener('touchstart', fn)
    }
  }, [ref, active])
}

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return true
    } catch {
      return false
    }
  }, [])
  return [copied, copy]
}

const RECENT_KEY = 'gn_recent'
/** Recently viewed vehicles (client-side, privacy-friendly). */
export function useRecentlyViewed() {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    } catch {
      return []
    }
  }
  const [items, setItems] = useState(read)
  const push = useCallback((card) => {
    const next = [card, ...read().filter((x) => x.id !== card.id)].slice(0, 12)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    setItems(next)
  }, [])
  return { items, push }
}

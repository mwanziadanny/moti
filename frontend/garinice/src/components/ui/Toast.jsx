import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/format'

const ToastContext = createContext(null)

const ICONS = {
  success: [CheckCircle2, 'text-success'],
  error: [XCircle, 'text-danger'],
  warning: [AlertTriangle, 'text-amber-500'],
  info: [Info, 'text-teal-600'],
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const seq = useRef(0)
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (tone, title, opts = {}) => {
      const id = ++seq.current
      setToasts((t) => [...t.slice(-3), { id, tone, title, description: opts.description, action: opts.action }])
      setTimeout(() => dismiss(id), opts.duration ?? (tone === 'error' ? 7000 : 4500))
      return id
    },
    [dismiss],
  )
  const api = useMemo(
    () => ({
      success: (t, o) => push('success', t, o),
      error: (t, o) => push('error', t, o),
      warning: (t, o) => push('warning', t, o),
      info: (t, o) => push('info', t, o),
      dismiss,
    }),
    [push, dismiss],
  )
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {toasts.map((t) => {
          const [Icon, color] = ICONS[t.tone]
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-pop">
              <Icon className={cn('mt-0.5 size-5 shrink-0', color)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
                {t.action && (
                  <button type="button" onClick={() => { t.action.onClick(); dismiss(t.id) }} className="mt-2 text-sm font-semibold text-teal-600 hover:underline">
                    {t.action.label}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 text-slate-400 hover:text-ink" aria-label="Dismiss notification">
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

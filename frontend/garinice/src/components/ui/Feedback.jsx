import { AlertTriangle, CheckCircle2, Info, RefreshCw, WifiOff, XCircle } from 'lucide-react'
import { LISTING_STATUSES, PAYMENT_STATUSES, REPORT_STATUSES } from '../../lib/constants'
import { cn } from '../../lib/format'

export function Spinner({ className, label = 'Loading' }) {
  return (
    <svg className={cn('animate-spin text-current', className || 'size-5')} viewBox="0 0 24 24" fill="none" role="status" aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  success: 'bg-green-50 text-green-700 ring-green-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  dark: 'bg-ink/85 text-white ring-transparent backdrop-blur-sm',
  accent: 'bg-amber-500 text-ink ring-amber-500',
}

export function Badge({ tone = 'neutral', icon: Icon, className, children, size = 'sm' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function StatusBadge({ status, kind = 'listing' }) {
  const map = kind === 'payment' ? PAYMENT_STATUSES : kind === 'report' ? REPORT_STATUSES : LISTING_STATUSES
  const s = map[status] || { label: status, tone: 'neutral' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-brand-50 text-brand-700">
          <Icon className="size-7" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, title, onRetry, className, compact }) {
  const offline = error?.status === 0 || error?.code === 'NETWORK'
  const Icon = offline ? WifiOff : AlertTriangle
  const heading = title || (offline ? 'You’re offline' : error?.status === 403 ? 'Access denied' : 'Something went wrong')
  const message = error?.message || 'We couldn’t load this content. Please try again.'
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-xl border border-red-100 bg-white text-center', compact ? 'px-4 py-6' : 'px-6 py-14', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-red-50 text-danger">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="font-semibold text-ink">{heading}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  )
}

const ALERT = {
  info: ['bg-sky-50 border-sky-200 text-sky-900', Info],
  success: ['bg-green-50 border-green-200 text-green-900', CheckCircle2],
  warning: ['bg-amber-50 border-amber-200 text-amber-900', AlertTriangle],
  danger: ['bg-red-50 border-red-200 text-red-900', XCircle],
}

export function Alert({ tone = 'info', title, children, className, action }) {
  const [cls, Icon] = ALERT[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border p-4 text-sm', cls, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

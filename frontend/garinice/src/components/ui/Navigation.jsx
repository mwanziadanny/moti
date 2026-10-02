import { ChevronLeft, ChevronRight, Home } from 'lucide-react'
import { Fragment, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/format'

export function Breadcrumbs({ items, className }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0 text-sm', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-muted scrollbar-none">
        <li>
          <Link to="/" className="flex items-center hover:text-ink" aria-label="Home">
            <Home className="size-4" aria-hidden="true" />
          </Link>
        </li>
        {items.map((item, i) => (
          <Fragment key={item.label}>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5 text-slate-400" />
            </li>
            <li className={cn(i === items.length - 1 && 'min-w-0 truncate')}>
              {item.to && i !== items.length - 1 ? (
                <Link to={item.to} className="hover:text-ink hover:underline">{item.label}</Link>
              ) : (
                <span aria-current={i === items.length - 1 ? 'page' : undefined} className="font-medium text-ink">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

function pageList(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const pages = new Set([1, count, page, page - 1, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= count - 2) [count - 1, count - 2, count - 3].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

/** Accessible pagination. `hrefFor` renders real links (crawlable); otherwise buttons. */
export function Pagination({ page, pageCount, onChange, hrefFor, className }) {
  if (!pageCount || pageCount <= 1) return null
  const item = ({ p, children, label, disabled, current, key }) => {
    const cls = cn(
      'inline-grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-medium transition-colors',
      current ? 'bg-brand-700 text-white' : 'text-ink hover:bg-slate-100',
      disabled && 'pointer-events-none opacity-40',
    )
    if (hrefFor && !disabled) {
      return <Link key={key} to={hrefFor(p)} className={cls} aria-label={label} aria-current={current ? 'page' : undefined} onClick={() => onChange?.(p)}>{children}</Link>
    }
    return <button key={key} type="button" className={cls} aria-label={label} aria-current={current ? 'page' : undefined} disabled={disabled} onClick={() => onChange?.(p)}>{children}</button>
  }
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      {item({ p: page - 1, label: 'Previous page', disabled: page <= 1, children: <ChevronLeft className="size-4" /> })}
      <div className="hidden items-center gap-1 sm:flex">
        {pageList(page, pageCount).map((p, i) =>
          p === '…' ? <span key={`e${i}`} className="px-2 text-muted">…</span> : item({ key: p, p, label: `Page ${p}`, current: p === page, children: p }),
        )}
      </div>
      <span className="px-3 text-sm text-muted sm:hidden">Page {page} of {pageCount}</span>
      {item({ p: page + 1, label: 'Next page', disabled: page >= pageCount, children: <ChevronRight className="size-4" /> })}
    </nav>
  )
}

/** WAI-ARIA tabs with arrow-key navigation. */
export function Tabs({ tabs, value, onChange, className, variant = 'underline' }) {
  const id = useId()
  const refs = useRef([])
  const onKey = (e, i) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (i + dir + tabs.length) % tabs.length
    refs.current[next]?.focus()
    onChange(tabs[next].value)
  }
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto scrollbar-none', variant === 'underline' ? 'border-b border-line' : 'rounded-lg bg-slate-100 p-1', className)}>
      {tabs.map((t, i) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            id={`${id}-${t.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            type="button"
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-3 py-2.5', active ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted hover:text-ink')
                : cn('rounded-md px-3 py-1.5', active ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'),
            )}
          >
            {t.label}
            {t.count != null && <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600')}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

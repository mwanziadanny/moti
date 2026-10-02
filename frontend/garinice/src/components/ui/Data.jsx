import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn, initials } from '../../lib/format'
import { resolveImageUrl } from '../../lib/demoImages'
import { Skeleton } from './Feedback'

export function Card({ className, children, as: Tag = 'div', padded = true, ...props }) {
  return (
    <Tag className={cn('rounded-xl border border-line bg-white shadow-card', padded && 'p-5 sm:p-6', className)} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatsCard({ label, value, icon: Icon, hint, trend, loading, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700' }
  return (
    <Card className="flex flex-col gap-3" padded>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn('grid size-9 place-items-center rounded-lg', tones[tone])}>
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? <Skeleton className="h-8 w-24" /> : <p className="font-display text-2xl font-bold tracking-tight text-ink tabular-nums sm:text-[28px]">{value}</p>}
      {(hint || trend != null) && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          {trend != null && (
            <span className={cn('inline-flex items-center font-semibold', trend >= 0 ? 'text-success' : 'text-danger')}>
              {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(trend)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </Card>
  )
}

export function Avatar({ name, src, size = 'md', className, square }) {
  const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }
  if (src) {
    return <img src={resolveImageUrl(src)} alt="" className={cn('shrink-0 bg-slate-100 object-cover', square ? 'rounded-xl' : 'rounded-full', sizes[size], className)} />
  }
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center bg-brand-100 font-semibold text-brand-700', square ? 'rounded-xl' : 'rounded-full', sizes[size], className)}>
      {initials(name) || '?'}
    </span>
  )
}

/**
 * Data table with optional row selection. Columns: { key, header, render?, className?, hideOn? }.
 * On small screens rows collapse into stacked cards for readability.
 */
export function DataTable({ columns, rows, rowKey = 'id', selectable, selected = [], onSelect, loading, empty, onRowClick, className }) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r[rowKey]))
  const someSelected = !allSelected && rows.some((r) => selected.includes(r[rowKey]))
  const headRef = useRef(null)
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someSelected
  }, [someSelected])
  const toggleAll = () => onSelect(allSelected ? selected.filter((id) => !rows.some((r) => r[rowKey] === id)) : [...new Set([...selected, ...rows.map((r) => r[rowKey])])])
  const toggle = (id) => onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-white shadow-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-slate-50/80 text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input ref={headRef} type="checkbox" className="size-4 accent-teal-600" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 whitespace-nowrap', c.hideOn && hide[c.hideOn], c.headerClassName)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {selectable && <td className="px-4 py-4"><Skeleton className="size-4" /></td>}
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-4 py-4', c.hideOn && hide[c.hideOn])}><Skeleton className="h-4 w-full max-w-40" /></td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = row[rowKey]
                  const isSel = selected.includes(id)
                  return (
                    <tr
                      key={id}
                      className={cn('transition-colors', isSel ? 'bg-teal-50/50' : 'hover:bg-slate-50/70', onRowClick && 'cursor-pointer')}
                      onClick={onRowClick ? (e) => !e.target.closest('a,button,input,select,label') && onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input type="checkbox" className="size-4 accent-teal-600" checked={isSel} onChange={() => toggle(id)} aria-label="Select row" />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={cn('px-4 py-3 align-middle', c.hideOn && hide[c.hideOn], c.className)}>
                          {c.render ? c.render(row) : row[c.key]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && <div className="px-6 py-12 text-center text-sm text-muted">{empty || 'Nothing to show yet.'}</div>}
    </div>
  )
}

/** Simple accessible dropdown menu. items: [{ label, icon, onClick, to, danger, disabled }] */
export function Menu({ trigger, items, align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const onMenuKey = (e) => {
    const items = [...ref.current.querySelectorAll('[role="menuitem"]:not([disabled])')]
    const i = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    }
  }
  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div role="menu" onKeyDown={onMenuKey} className={cn('absolute z-50 mt-2 min-w-52 animate-fade-in rounded-xl border border-line bg-white p-1.5 shadow-lift', align === 'right' ? 'right-0' : 'left-0')}>
          {items.filter(Boolean).map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 h-px bg-line" role="separator" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onClick?.()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none disabled:opacity-40',
                  item.danger ? 'text-danger hover:bg-red-50 focus:bg-red-50' : 'text-ink hover:bg-slate-100 focus:bg-slate-100',
                )}
              >
                {item.icon && <item.icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

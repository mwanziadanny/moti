import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../../lib/format'
import { Drawer } from '../ui/Overlay'

function NavList({ items, onNavigate }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) =>
        item.section ? (
          <li key={item.section} className="px-3 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{item.section}</li>
        ) : (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-ink')}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-white' : 'text-slate-400')} aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? <span className={cn('rounded-full px-1.5 text-xs font-semibold', isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700')}>{item.badge}</span> : null}
                </>
              )}
            </NavLink>
          </li>
        ),
      )}
    </ul>
  )
}

/** Sidebar layout for dashboard & admin. Mobile gets a section drawer. */
export function SideNavLayout({ title, items, header }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const current = [...items].filter((i) => i.to).sort((a, b) => b.to.length - a.to.length).find((i) => pathname === i.to || (!i.end && pathname.startsWith(`${i.to}/`)))
  return (
    <div className="container-page flex gap-8 py-6 lg:py-8">
      <aside className="hidden w-60 shrink-0 lg:block" aria-label={`${title} navigation`}>
        <div className="sticky top-24">
          {header}
          <nav className="max-h-[calc(100dvh-8rem)] overflow-y-auto pb-6 scrollbar-none"><NavList items={items} /></nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setOpen(true)} className="mb-5 flex w-full items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-left text-sm font-medium shadow-card lg:hidden" aria-expanded={open}>
          <Menu className="size-5 text-slate-500" aria-hidden="true" />
          <span className="text-muted">{title}:</span> {current?.label || 'Menu'}
        </button>
        <Outlet />
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={title} side="left" width="max-w-xs">
        <div className="p-3">{header}<NavList items={items} onNavigate={() => setOpen(false)} /></div>
      </Drawer>
    </div>
  )
}

export function PageTitle({ title, description, action, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        {children}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, Car, ChevronDown, Heart, LayoutDashboard, LogOut, Menu as MenuIcon, MessageSquare, Search, Shield, User, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useUnreadCounts } from '../../hooks/queries'
import { useAuth } from '../../hooks/useAuth'
import { useOnClickOutside } from '../../hooks/useUtils'
import { cn, timeAgo } from '../../lib/format'
import { SearchAutocomplete } from '../search/SearchAutocomplete'
import { Button } from '../ui/Button'
import { Avatar, Menu } from '../ui/Data'
import { Drawer } from '../ui/Overlay'
import { Logo } from './Logo'

const PRIMARY_NAV = [
  { to: '/cars', label: 'Browse Cars' },
  { to: '/sell', label: 'Sell Your Car' },
  { to: '/dealers', label: 'Dealers' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
]

function CountBadge({ n }) {
  if (!n) return null
  return <span className="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">{n > 9 ? '9+' : n}</span>
}

function NotificationsButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: unread } = useUnreadCounts()
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list, enabled: open })
  const markRead = useMutation({
    mutationFn: () => api.notifications.markRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unread'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  useOnClickOutside(ref, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const count = unread?.notifications || 0
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-ink">
        <Bell className="size-5" />
        <CountBadge n={count} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] animate-fade-in rounded-xl border border-line bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {count > 0 && <button type="button" onClick={() => markRead.mutate()} className="text-xs font-medium text-teal-700 hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 overflow-auto py-1">
            {isLoading && <li className="px-4 py-6 text-center text-sm text-muted">Loading…</li>}
            {data?.items?.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</li>}
            {data?.items?.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (!n.readAt) api.notifications.markRead([n.id]).then(() => qc.invalidateQueries({ queryKey: ['unread'] }))
                    if (n.link) navigate(n.link)
                  }}
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-teal-600')} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-muted">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout, isAdmin, isSeller } = useAuth()
  const navigate = useNavigate()
  return (
    <Menu
      trigger={(p) => (
        <button type="button" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu" className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-slate-100" aria-label="Account menu">
          <Avatar name={user.name} size="sm" />
          <span className="hidden max-w-28 truncate text-sm font-medium xl:block">{user.name.split(' ')[0]}</span>
          <ChevronDown className="size-4 text-slate-500" aria-hidden="true" />
        </button>
      )}
      items={[
        { label: 'Dashboard', icon: LayoutDashboard, onClick: () => navigate('/dashboard') },
        { label: 'Messages', icon: MessageSquare, onClick: () => navigate(isSeller ? '/dashboard/messages' : '/messages') },
        { label: 'Saved cars', icon: Heart, onClick: () => navigate('/saved') },
        isSeller && { label: 'My listings', icon: Car, onClick: () => navigate('/dashboard/listings') },
        { label: 'Profile', icon: User, onClick: () => navigate('/account') },
        isAdmin && { divider: true },
        isAdmin && { label: 'Admin dashboard', icon: Shield, onClick: () => navigate('/admin') },
        { divider: true },
        { label: 'Sign out', icon: LogOut, danger: true, onClick: async () => { await logout(); navigate('/') } },
      ]}
    />
  )
}

export function SiteHeader() {
  const { user, isAdmin, isSeller, logout } = useAuth()
  const { data: unread } = useUnreadCounts()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Close overlays on navigation.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMenuOpen(false)
    setSearchOpen(false)
  }

  const linkCls = ({ isActive }) => cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', isActive ? 'text-brand-700 bg-brand-50' : 'text-slate-700 hover:text-ink hover:bg-slate-100')
  const msgHref = isSeller ? '/dashboard/messages' : '/messages'

  return (
    <header className={cn('sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 transition-shadow', scrolled ? 'border-line shadow-[0_2px_12px_-6px_rgb(15_23_42/0.18)]' : 'border-transparent')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <div className="container-page flex h-16 items-center gap-3 lg:h-[72px]">
        <Logo />
        <nav aria-label="Primary" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {PRIMARY_NAV.map((l) => <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>)}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button type="button" onClick={() => setSearchOpen(true)} className="grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-ink xl:hidden" aria-label="Open search">
            <Search className="size-5" />
          </button>
          <div className="hidden w-56 xl:block 2xl:w-72">
            {pathname !== '/' && <SearchAutocomplete size="sm" placeholder="Search cars…" />}
          </div>
          <Link to="/saved" className="relative grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-ink" aria-label="Saved cars">
            <Heart className="size-5" />
          </Link>
          {user ? (
            <>
              <Link to={msgHref} className="relative hidden size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-ink sm:grid" aria-label={`Messages${unread?.unread ? `, ${unread.unread} unread` : ''}`}>
                <MessageSquare className="size-5" />
                <CountBadge n={unread?.unread} />
              </Link>
              <div className="hidden sm:block"><NotificationsButton /></div>
              <div className="hidden lg:block"><UserMenu /></div>
            </>
          ) : (
            <div className="hidden items-center gap-1 lg:flex">
              <Button variant="ghost" size="sm" to={`/login?next=${encodeURIComponent(pathname)}`}>Login</Button>
              <Button variant="secondary" size="sm" to="/register">Create Account</Button>
            </div>
          )}
          <Button variant="accent" size="sm" to="/sell/vehicle" className="ml-1 hidden sm:inline-flex">Sell a Car</Button>
          <button type="button" onClick={() => setMenuOpen(true)} className="relative grid size-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Open menu" aria-expanded={menuOpen}>
            <MenuIcon className="size-6" />
            {user && <CountBadge n={(unread?.unread || 0) + (unread?.notifications || 0)} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 xl:absolute xl:inset-auto xl:top-full xl:right-0 xl:left-0 xl:bg-transparent" onClick={() => setSearchOpen(false)}>
          <div className="border-b border-line bg-white p-4 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="container-page flex items-center gap-2 px-0!">
              <SearchAutocomplete autoFocus className="flex-1" onSubmitted={() => setSearchOpen(false)} />
              <button type="button" onClick={() => setSearchOpen(false)} className="grid size-11 place-items-center rounded-lg hover:bg-slate-100" aria-label="Close search"><X className="size-5" /></button>
            </div>
          </div>
        </div>
      )}

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="right" width="max-w-sm">
        <div className="flex flex-col gap-1 p-4">
          {user && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <Avatar name={user.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
          )}
          {[{ to: '/', label: 'Home' }, ...PRIMARY_NAV].map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cn('rounded-lg px-3 py-3 text-[15px] font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-slate-100')}>{l.label}</NavLink>
          ))}
          <div className="my-3 h-px bg-line" />
          {user ? (
            <>
              {[
                ['/dashboard', 'Dashboard', LayoutDashboard],
                [msgHref, `Messages${unread?.unread ? ` (${unread.unread})` : ''}`, MessageSquare],
                ['/saved', 'Saved cars', Heart],
                isSeller && ['/dashboard/listings', 'My listings', Car],
                ['/account', 'Profile', User],
                isAdmin && ['/admin', 'Admin dashboard', Shield],
              ].filter(Boolean).map(([to, label, Icon]) => (
                <Link key={to} to={to} className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] hover:bg-slate-100"><Icon className="size-5 text-slate-500" />{label}</Link>
              ))}
              <button type="button" onClick={async () => { await logout(); navigate('/') }} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] text-danger hover:bg-red-50"><LogOut className="size-5" />Sign out</button>
            </>
          ) : (
            <div className="grid gap-2">
              <Button variant="secondary" to={`/login?next=${encodeURIComponent(pathname)}`} block>Login</Button>
              <Button variant="primary" to="/register" block>Create Account</Button>
            </div>
          )}
          <Button variant="accent" to="/sell/vehicle" block className="mt-3">Sell a Car</Button>
        </div>
      </Drawer>
    </header>
  )
}

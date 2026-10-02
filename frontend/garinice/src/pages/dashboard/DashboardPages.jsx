import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive, BarChart3, Car, CheckCircle2, CreditCard, Eye, Heart, LayoutDashboard, Mail, MessageSquare, MoreHorizontal, Pause, Pencil,
  Phone, Play, PlusCircle, RefreshCw, Rocket, Settings, Store, Trash2, TrendingUp, User, Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { PageTitle, SideNavLayout } from '../../components/layout/SideNavLayout'
import { WhatsAppIcon } from '../../components/ui/BrandIcons'
import { Button } from '../../components/ui/Button'
import { BarList, TimeSeriesChart } from '../../components/ui/Chart'
import { Avatar, Card, CardHeader, DataTable, Menu, StatsCard } from '../../components/ui/Data'
import { Alert, Badge, EmptyState, ErrorState, Skeleton, StatusBadge } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Form'
import { Pagination, Tabs } from '../../components/ui/Navigation'
import { ConfirmDialog } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { VehicleImage } from '../../components/vehicle/VehicleCard'
import { Inbox } from '../../features/messages/Inbox'
import { PaymentDialog } from '../../features/payments/PaymentDialog'
import { useUnreadCounts } from '../../hooks/queries'
import { useAuth } from '../../hooks/useAuth'
import { Seo } from '../../hooks/useSeo'
import { useDebounce } from '../../hooks/useUtils'
import { LISTING_STATUSES } from '../../lib/constants'
import { formatDate, formatDateTime, formatKES, formatNumber, timeAgo } from '../../lib/format'
import { ProfileForm, SecuritySection } from '../account/AccountPages'

export function DashboardLayout() {
  const { user, isSeller, isDealer } = useAuth()
  const { data: unread } = useUnreadCounts()
  const items = [
    { to: '/dashboard', end: true, label: 'Dashboard', icon: LayoutDashboard },
    ...(isSeller ? [
      { to: '/dashboard/listings', label: 'My Listings', icon: Car },
      { to: '/sell/vehicle', label: 'Add Vehicle', icon: PlusCircle },
    ] : []),
    { to: '/dashboard/messages', label: 'Messages', icon: MessageSquare, badge: unread?.unread },
    ...(isSeller ? [{ to: '/dashboard/leads', label: 'Leads', icon: TrendingUp }] : []),
    { to: '/saved', label: 'Favourites', icon: Heart },
    ...(isSeller ? [
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/dashboard/payments', label: 'Payments', icon: CreditCard },
    ] : []),
    ...(isDealer ? [{ section: 'Dealership' }, { to: '/dashboard/dealer', label: 'Storefront', icon: Store }, { to: '/dashboard/staff', label: 'Staff', icon: Users }] : []),
    { section: 'Account' },
    { to: '/dashboard/profile', label: 'Profile', icon: User },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]
  const header = (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <Avatar src={user.dealer?.logoUrl} name={user.dealer?.name || user.name} square={!!user.dealer} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.dealer?.name || user.name}</p>
        <p className="truncate text-xs text-muted">{user.dealer ? `${user.name} · ${user.dealer.staffRole === 'OWNER' ? 'Owner' : 'Staff'}` : user.email}</p>
      </div>
    </div>
  )
  return <SideNavLayout title="Dashboard" items={items} header={header} />
}

function QuotaCard() {
  const { data } = useQuery({ queryKey: ['quota'], queryFn: api.vehicles.quota })
  if (!data) return <Skeleton className="h-28 rounded-xl" />
  const pct = Math.min(100, Math.round((data.used / Math.max(1, data.allowance)) * 100))
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{data.packageName}</p>
        {data.renewsAt && <span className="text-xs text-muted">Renews {formatDate(data.renewsAt)}</span>}
      </div>
      <p className="mt-2 font-display text-xl font-bold">{data.used} <span className="text-sm font-medium text-muted">of {data.allowance} active listings</span></p>
      <div className="mt-3 h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.used} aria-valuemax={data.allowance} aria-label="Listing allowance used">
        <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-danger' : 'bg-teal-600'}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 90 && <Link to="/dashboard/payments" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">Upgrade your package</Link>}
    </Card>
  )
}

export function DashboardHome() {
  const { user, isSeller } = useAuth()
  const analytics = useQuery({ queryKey: ['seller-analytics', 30], queryFn: () => api.seller.analytics(30), enabled: isSeller })
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list })
  const leads = useQuery({ queryKey: ['leads', 1], queryFn: () => api.seller.leads({ page: 1 }), enabled: isSeller })
  const { data: unread } = useUnreadCounts()
  const t = analytics.data?.totals
  return (
    <>
      <Seo title="Dashboard" noindex />
      <PageTitle title={`Welcome back, ${user.name.split(' ')[0]}`} description={isSeller ? 'Here’s how your listings performed in the last 30 days.' : 'Manage your saved cars and conversations.'} action={isSeller && <Button variant="accent" icon={PlusCircle} to="/sell/vehicle">Add vehicle</Button>} />
      {isSeller ? (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            <StatsCard label="Active listings" value={formatNumber(t?.activeListings)} icon={Car} loading={!t} hint={t?.pending ? `${t.pending} pending review` : undefined} />
            <StatsCard label="Views" value={formatNumber(t?.views)} icon={Eye} tone="teal" loading={!t} hint="Last 30 days" />
            <StatsCard label="Messages" value={formatNumber(unread?.unread ?? 0)} icon={MessageSquare} tone="amber" loading={!t} hint="Unread" />
            <StatsCard label="Enquiries" value={formatNumber(t ? t.enquiries + t.phoneClicks + t.whatsappClicks : 0)} icon={Phone} tone="green" loading={!t} hint="Chats, calls & WhatsApp" />
            <StatsCard label="Sold vehicles" value={formatNumber(t?.sold)} icon={CheckCircle2} tone="brand" loading={!t} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Listing views" description="Daily views across all your listings" action={<Link to="/dashboard/analytics" className="text-sm font-medium text-teal-700 hover:underline">Full analytics</Link>} />
              {analytics.data ? <TimeSeriesChart data={analytics.data.series.map((s) => ({ date: s.date, value: s.views }))} label="Daily listing views" valueLabel="Views" /> : <Skeleton className="h-56" />}
            </Card>
            <QuotaCard />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent leads" action={<Link to="/dashboard/leads" className="text-sm font-medium text-teal-700 hover:underline">View all</Link>} />
              <LeadList items={leads.data?.items?.slice(0, 5)} loading={leads.isLoading} />
            </Card>
            <Card>
              <CardHeader title="Recent activity" />
              <ActivityList items={notifications.data?.items?.slice(0, 6)} loading={notifications.isLoading} />
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Your activity" />
            <div className="grid grid-cols-2 gap-3">
              <Link to="/saved" className="rounded-lg bg-slate-50 p-4 hover:bg-slate-100"><Heart className="size-5 text-danger" aria-hidden="true" /><p className="mt-2 font-semibold">Saved cars</p></Link>
              <Link to="/messages" className="rounded-lg bg-slate-50 p-4 hover:bg-slate-100"><MessageSquare className="size-5 text-teal-700" aria-hidden="true" /><p className="mt-2 font-semibold">Messages {unread?.unread ? `(${unread.unread})` : ''}</p></Link>
            </div>
          </Card>
          <Card className="bg-teal-700 text-white">
            <h2 className="text-lg font-bold">Thinking of selling?</h2>
            <p className="mt-1 text-sm text-teal-50">List your car for free and reach buyers across Kenya.</p>
            <Button variant="accent" className="mt-4" to="/sell/vehicle">List your car</Button>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Notifications" />
            <ActivityList items={notifications.data?.items?.slice(0, 8)} loading={notifications.isLoading} />
          </Card>
        </div>
      )}
    </>
  )
}

function ActivityList({ items, loading }) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
  if (!items?.length) return <p className="py-6 text-center text-sm text-muted">No activity yet.</p>
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => (
        <li key={n.id} className="flex gap-3 py-3">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-slate-300' : 'bg-teal-600'}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            {n.link ? <Link to={n.link} className="text-sm font-medium hover:underline">{n.title}</Link> : <p className="text-sm font-medium">{n.title}</p>}
            <p className="truncate text-xs text-muted">{n.body}</p>
          </div>
          <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
        </li>
      ))}
    </ul>
  )
}

const LEAD_ICON = { MESSAGE: MessageSquare, PHONE_CLICK: Phone, WHATSAPP_CLICK: WhatsAppIcon, EMAIL_CLICK: Mail }
const LEAD_LABEL = { MESSAGE: 'Message', PHONE_CLICK: 'Viewed phone number', WHATSAPP_CLICK: 'Opened WhatsApp', EMAIL_CLICK: 'Clicked email' }

function LeadList({ items, loading }) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
  if (!items?.length) return <p className="py-6 text-center text-sm text-muted">No leads yet. Share your listings to get more enquiries.</p>
  return (
    <ul className="divide-y divide-line">
      {items.map((l) => {
        const Icon = LEAD_ICON[l.kind] || MessageSquare
        return (
          <li key={l.id} className="flex items-center gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.contactName} <span className="font-normal text-muted">· {LEAD_LABEL[l.kind]}</span></p>
              <p className="truncate text-xs text-muted">{l.vehicle.title}{l.preview ? ` — “${l.preview}”` : ''}</p>
            </div>
            <div className="shrink-0 text-right">
              {l.status === 'NEW' && <Badge tone="warning">New</Badge>}
              {l.status === 'RESPONDED' && <Badge tone="success">Replied</Badge>}
              <p className="mt-0.5 text-xs text-muted">{timeAgo(l.lastActivityAt)}</p>
            </div>
            {l.conversationId && <Button size="xs" variant="secondary" to={`/dashboard/messages?c=${l.conversationId}`}>Open</Button>}
          </li>
        )
      })}
    </ul>
  )
}

export function LeadsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['leads', page], queryFn: () => api.seller.leads({ page }), placeholderData: keepPreviousData })
  return (
    <>
      <Seo title="Leads" noindex />
      <PageTitle title="Leads" description="Everyone who messaged you, viewed your number or opened WhatsApp in the last 30 days." />
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <Card>
          <LeadList items={data?.items} loading={isLoading} />
          {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={setPage} />}
        </Card>
      )}
    </>
  )
}

export function MyListingsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'ALL'
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const qc = useQueryClient()
  const toast = useToast()
  const [confirm, setConfirm] = useState(null)
  const [promote, setPromote] = useState(null)
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['my-vehicles', status, dq, page], queryFn: () => api.vehicles.mine({ status, q: dq, page }), placeholderData: keepPreviousData })
  const { data: pkgs } = useQuery({ queryKey: ['packages'], queryFn: api.catalog.packages })
  const action = useMutation({
    mutationFn: ({ id, action: a }) => (a === 'delete' ? api.vehicles.remove(id) : api.vehicles.setStatus(id, a)),
    onSuccess: (res, { action: a }) => {
      qc.invalidateQueries({ queryKey: ['my-vehicles'] })
      qc.invalidateQueries({ queryKey: ['quota'] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      const msg = { pause: 'Listing paused', resume: 'Listing is live again', mark_sold: 'Marked as sold 🎉', archive: 'Listing archived', delete: 'Listing deleted', submit: res?.status === 'PUBLISHED' ? 'Listing published' : 'Submitted for review', relist: res?.status === 'PUBLISHED' ? 'Listing relisted' : 'Submitted for review' }[a]
      toast.success(msg)
      setConfirm(null)
    },
    onError: (e) => {
      toast.error('Action failed', { description: e.message })
      setConfirm(null)
    },
  })
  const setStatus = (s) => setParams(s === 'ALL' ? {} : { status: s })
  const counts = data?.counts || {}
  const tabs = ['ALL', 'PUBLISHED', 'PENDING_REVIEW', 'DRAFT', 'PAUSED', 'SOLD', 'REJECTED', 'EXPIRED'].map((s) => ({ value: s, label: s === 'ALL' ? 'All' : LISTING_STATUSES[s].label, count: counts[s] || 0 })).filter((t) => t.value === 'ALL' || t.count || t.value === status)

  const menuFor = (v) => [
    { label: 'View listing', icon: Eye, onClick: () => navigate(`/vehicle/${v.slug}`) },
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sell/vehicle?edit=${v.id}`) },
    v.status === 'PUBLISHED' && { label: 'Promote', icon: Rocket, onClick: () => setPromote(v) },
    v.status === 'PUBLISHED' && { label: 'Pause', icon: Pause, onClick: () => action.mutate({ id: v.id, action: 'pause' }) },
    v.status === 'PAUSED' && !v.hiddenByAdmin && { label: 'Resume', icon: Play, onClick: () => action.mutate({ id: v.id, action: 'resume' }) },
    ['DRAFT', 'REJECTED'].includes(v.status) && { label: 'Submit for review', icon: CheckCircle2, onClick: () => action.mutate({ id: v.id, action: 'submit' }) },
    ['SOLD', 'EXPIRED', 'ARCHIVED'].includes(v.status) && { label: 'Relist', icon: RefreshCw, onClick: () => action.mutate({ id: v.id, action: 'relist' }) },
    ['PUBLISHED', 'PAUSED'].includes(v.status) && { label: 'Mark as sold', icon: CheckCircle2, onClick: () => setConfirm({ v, action: 'mark_sold' }) },
    v.status !== 'ARCHIVED' && { label: 'Archive', icon: Archive, onClick: () => action.mutate({ id: v.id, action: 'archive' }) },
    { divider: true },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm({ v, action: 'delete' }) },
  ]

  return (
    <>
      <Seo title="My listings" noindex />
      <PageTitle title="My listings" description="Manage, edit and promote your vehicles." action={<Button variant="accent" icon={PlusCircle} to="/sell/vehicle">Add vehicle</Button>} />
      <Tabs tabs={tabs} value={status} onChange={setStatus} className="mb-4" />
      <Input aria-label="Search your listings" placeholder="Search by title or reference" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" size="sm" />
      {error ? <ErrorState error={error} onRetry={refetch} /> : !isLoading && data.items.length === 0 ? (
        <EmptyState icon={Car} title={status === 'ALL' ? 'No listings yet' : `No ${LISTING_STATUSES[status]?.label.toLowerCase()} listings`} description="List your first car in about 10 minutes — it’s free." action={<Button to="/sell/vehicle" icon={PlusCircle}>List a car</Button>} />
      ) : (
        <div className="space-y-3">
          {(isLoading ? Array.from({ length: 4 }) : data.items).map((v, i) =>
            !v ? <Skeleton key={i} className="h-28 rounded-xl" /> : (
              <Card key={v.id} padded={false} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <Link to={`/vehicle/${v.slug}`} className="shrink-0"><VehicleImage image={v.image} alt="" thumb className="aspect-[4/3] w-full rounded-lg sm:w-36" /></Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/vehicle/${v.slug}`} className="truncate font-semibold hover:underline">{v.title || 'Untitled draft'}</Link>
                    <StatusBadge status={v.status} />
                    {v.featured && <Badge tone="accent">Featured</Badge>}
                    {v.boosted && !v.featured && <Badge tone="info">Boosted</Badge>}
                  </div>
                  <p className="mt-1 font-display font-bold text-brand-700">{v.price ? formatKES(v.price) : '—'}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>Ref {v.ref}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="size-3.5" aria-hidden="true" />{formatNumber(v.views)} views</span>
                    <span className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-hidden="true" />{v.favouritesCount}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" aria-hidden="true" />{v.enquiries} enquiries</span>
                    {v.status === 'PUBLISHED' && v.expiresAt && <span>Expires {formatDate(v.expiresAt)}</span>}
                    {v.sellerName && <span>By {v.sellerName}</span>}
                  </p>
                  {(v.changesRequested || (v.status === 'REJECTED' && v.lastModeration?.note)) && <Alert tone="warning" className="mt-3 py-2.5">{v.changesRequested ? `Changes requested: ${v.changesRequested}` : `Rejected: ${v.lastModeration.note}`}</Alert>}
                  {v.hiddenByAdmin && <Alert tone="danger" className="mt-3 py-2.5">Hidden by moderators. Contact support for details.</Alert>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {['DRAFT', 'REJECTED'].includes(v.status) ? <Button size="sm" variant="secondary" icon={Pencil} to={`/sell/vehicle?edit=${v.id}`}>Continue</Button> : v.status === 'PUBLISHED' ? <Button size="sm" variant="subtle" icon={Rocket} onClick={() => setPromote(v)}>Promote</Button> : null}
                  <Menu trigger={(p) => <Button variant="secondary" size="icon-sm" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu" aria-label={`Actions for ${v.title}`}><MoreHorizontal className="size-4" /></Button>} items={menuFor(v)} />
                </div>
              </Card>
            ),
          )}
          {data && <Pagination className="mt-6" page={data.page} pageCount={data.pageCount} onChange={(p) => setParams({ ...(status !== 'ALL' && { status }), page: p })} />}
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        loading={action.isPending}
        tone={confirm?.action === 'delete' ? 'danger' : 'primary'}
        title={confirm?.action === 'delete' ? 'Delete this listing?' : 'Mark as sold?'}
        description={confirm?.action === 'delete' ? `${confirm?.v.title} will be permanently removed.` : `${confirm?.v.title} will be removed from active search results. Buyers who saved it will be notified.`}
        confirmLabel={confirm?.action === 'delete' ? 'Delete' : 'Mark as sold'}
        onConfirm={() => action.mutate({ id: confirm.v.id, action: confirm.action })}
      />
      {promote && <PaymentDialog open onClose={() => setPromote(null)} vehicle={promote} packages={(pkgs?.items || []).filter((p) => p.audience !== 'DEALER' && p.price > 0)} onPaid={() => qc.invalidateQueries({ queryKey: ['my-vehicles'] })} />}
    </>
  )
}

export function DashboardMessagesPage() {
  return (
    <>
      <Seo title="Messages" noindex />
      <PageTitle title="Messages" />
      <Inbox mode="seller" />
    </>
  )
}

export function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['seller-analytics', days], queryFn: () => api.seller.analytics(days), placeholderData: keepPreviousData })
  const t = data?.totals
  return (
    <>
      <Seo title="Analytics" noindex />
      <PageTitle title="Analytics" description="How buyers engage with your listings." action={
        <Select size="sm" aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </Select>
      } />
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Views" value={formatNumber(t?.views)} icon={Eye} loading={isLoading} />
            <StatsCard label="Phone reveals" value={formatNumber(t?.phoneClicks)} icon={Phone} tone="teal" loading={isLoading} />
            <StatsCard label="WhatsApp clicks" value={formatNumber(t?.whatsappClicks)} icon={MessageSquare} tone="green" loading={isLoading} />
            <StatsCard label="Saves" value={formatNumber(t?.favourites)} icon={Heart} tone="red" loading={isLoading} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card><CardHeader title="Views" />{data ? <TimeSeriesChart data={data.series.map((s) => ({ date: s.date, value: s.views }))} label="Daily views" valueLabel="Views" /> : <Skeleton className="h-56" />}</Card>
            <Card><CardHeader title="Contacts" description="Messages, calls, WhatsApp and email clicks" />{data ? <TimeSeriesChart data={data.series.map((s) => ({ date: s.date, value: s.contacts }))} label="Daily contacts" valueLabel="Contacts" color="teal" /> : <Skeleton className="h-56" />}</Card>
          </div>
          <Card className="mt-6">
            <CardHeader title="Top listings by views" />
            <BarList data={(data?.perListing || []).slice(0, 8).map((l) => ({ label: l.title, value: l.views }))} label="Views per listing" valueLabel="Views" color="brand" />
          </Card>
          <h2 className="mt-8 mb-3 font-semibold">Listing performance</h2>
          <DataTable
            loading={isLoading}
            rows={data?.perListing || []}
            empty="No published listings in this period."
            columns={[
              { key: 'title', header: 'Listing', render: (r) => <Link to={`/vehicle/${r.slug}`} className="font-medium hover:underline">{r.title}</Link> },
              { key: 'status', header: 'Status', hideOn: 'md', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'views', header: 'Views', className: 'tabular-nums', render: (r) => formatNumber(r.views) },
              { key: 'contacts', header: 'Contacts', className: 'tabular-nums', render: (r) => formatNumber(r.contacts) },
              { key: 'favourites', header: 'Saves', hideOn: 'sm', className: 'tabular-nums' },
              { key: 'conversion', header: 'Contact rate', hideOn: 'sm', render: (r) => `${r.conversion}%` },
            ]}
          />
        </>
      )}
    </>
  )
}

export function PaymentsPage() {
  const { isDealer } = useAuth()
  const [page, setPage] = useState(1)
  const [buy, setBuy] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['payments', page], queryFn: () => api.payments.list({ page }), placeholderData: keepPreviousData })
  const { data: pkgs } = useQuery({ queryKey: ['packages'], queryFn: api.catalog.packages })
  const dealerPkgs = (pkgs?.items || []).filter((p) => p.audience === 'DEALER')
  return (
    <>
      <Seo title="Payments" noindex />
      <PageTitle title="Payments" description="Your package purchases and transaction history." action={isDealer && dealerPkgs.length > 0 && <Button variant="accent" icon={CreditCard} onClick={() => setBuy(true)}>Buy dealer package</Button>} />
      {isDealer && <div className="mb-6"><QuotaCard /></div>}
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          empty={<span>No payments yet. <Link to="/dashboard/listings" className="font-medium text-teal-700 hover:underline">Promote a listing</Link> to reach more buyers.</span>}
          columns={[
            { key: 'createdAt', header: 'Date', render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
            { key: 'reference', header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
            { key: 'purpose', header: 'Purpose', render: (r) => <span>{r.package?.name}{r.vehicle && <Link to={`/vehicle/${r.vehicle.slug}`} className="block text-xs text-muted hover:underline">{r.vehicle.title}</Link>}</span> },
            { key: 'amount', header: 'Amount', className: 'tabular-nums whitespace-nowrap', render: (r) => formatKES(r.amount) },
            { key: 'gateway', header: 'Method', hideOn: 'md', render: (r) => <span>M-Pesa{r.receipt && <span className="block font-mono text-xs text-muted">{r.receipt}</span>}</span> },
            { key: 'status', header: 'Status', render: (r) => <span title={r.failureReason || undefined}><StatusBadge status={r.status} kind="payment" /></span> },
          ]}
        />
      )}
      {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={setPage} />}
      {buy && <PaymentDialog open onClose={() => setBuy(false)} packages={dealerPkgs} onPaid={() => refetch()} />}
    </>
  )
}

export function ProfilePage() {
  return (
    <>
      <Seo title="Profile" noindex />
      <PageTitle title="Profile" />
      <ProfileForm />
    </>
  )
}

export function SettingsPage() {
  return (
    <>
      <Seo title="Settings" noindex />
      <PageTitle title="Settings" description="Password and account management." />
      <SecuritySection />
    </>
  )
}

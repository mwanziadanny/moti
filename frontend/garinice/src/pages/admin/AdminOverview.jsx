import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  BarChart3, Building2, Car, ClipboardCheck, CreditCard, FileText, Flag, FolderTree, Gauge, Globe, History, Home, LayoutDashboard,
  ListChecks, Mail, MessageSquare, Package, Settings, Shapes, Shield, Sparkles, Tag, UserCheck, Users, Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageTitle, SideNavLayout } from '../../components/layout/SideNavLayout'
import { BarList, TimeSeriesChart } from '../../components/ui/Chart'
import { Card, CardHeader, DataTable, StatsCard } from '../../components/ui/Data'
import { Badge, ErrorState, Skeleton, StatusBadge } from '../../components/ui/Feedback'
import { Select } from '../../components/ui/Form'
import { useAuth } from '../../hooks/useAuth'
import { Seo } from '../../hooks/useSeo'
import { formatCompactKES, formatKES, formatNumber, timeAgo } from '../../lib/format'

export function AdminLayout() {
  const { user } = useAuth()
  const { data } = useQuery({ queryKey: ['admin-overview', 30], queryFn: () => api.admin.overview(30), staleTime: 30_000 })
  const k = data?.kpis
  const items = [
    { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
    { section: 'Inventory' },
    { to: '/admin/vehicles', label: 'Vehicles', icon: Car },
    { to: '/admin/listings', label: 'Listings', icon: ClipboardCheck, badge: k?.pendingApprovals },
    { to: '/admin/reports', label: 'Reports', icon: Flag, badge: k?.openReports },
    { section: 'People' },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/sellers', label: 'Sellers', icon: UserCheck },
    { to: '/admin/dealers', label: 'Dealers', icon: Building2 },
    { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
    { section: 'Taxonomy' },
    { to: '/admin/brands', label: 'Brands', icon: Tag },
    { to: '/admin/models', label: 'Models', icon: Shapes },
    { to: '/admin/categories', label: 'Categories', icon: FolderTree },
    { section: 'Revenue' },
    { to: '/admin/payments', label: 'Payments', icon: Wallet },
    { to: '/admin/packages', label: 'Packages', icon: Package },
    { to: '/admin/promotions', label: 'Promotions', icon: Sparkles },
    { section: 'Content' },
    { to: '/admin/homepage', label: 'Homepage', icon: Home },
    { to: '/admin/cms', label: 'CMS', icon: FileText },
    { to: '/admin/seo', label: 'SEO', icon: Globe },
    { section: 'System' },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: History },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ]
  const header = (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-800 p-3 text-white">
      <span className="grid size-9 place-items-center rounded-lg bg-white/10"><Shield className="size-5 text-amber-400" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Admin</p>
        <p className="truncate text-xs text-brand-200">{user.name} · {user.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}</p>
      </div>
    </div>
  )
  return <SideNavLayout title="Admin" items={items} header={header} />
}

function useOverview(days) {
  return useQuery({ queryKey: ['admin-overview', days], queryFn: () => api.admin.overview(days), placeholderData: keepPreviousData })
}

const RangeSelect = ({ days, setDays }) => (
  <Select size="sm" aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
    <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={180}>Last 180 days</option>
  </Select>
)

export function AdminOverviewPage() {
  const [days, setDays] = useState(30)
  const { data, isLoading, error, refetch } = useOverview(days)
  const k = data?.kpis
  if (error) return <ErrorState error={error} onRetry={refetch} />
  return (
    <>
      <Seo title="Admin overview" noindex />
      <PageTitle title="Overview" description="Marketplace health at a glance." action={<RangeSelect days={days} setDays={setDays} />} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatsCard label="Total vehicles" value={formatNumber(k?.totalVehicles)} icon={Car} loading={isLoading} />
        <StatsCard label="Active listings" value={formatNumber(k?.activeListings)} icon={ListChecks} tone="teal" loading={isLoading} />
        <StatsCard label="Pending approvals" value={formatNumber(k?.pendingApprovals)} icon={ClipboardCheck} tone="amber" loading={isLoading} hint={<Link to="/admin/listings" className="font-medium text-teal-700 hover:underline">Review queue</Link>} />
        <StatsCard label="Registered users" value={formatNumber(k?.registeredUsers)} icon={Users} loading={isLoading} hint={k && `+${k.newUsers} in period`} />
        <StatsCard label="Dealers" value={formatNumber(k?.dealers)} icon={Building2} tone="teal" loading={isLoading} />
        <StatsCard label="Messages" value={formatNumber(k?.messages)} icon={MessageSquare} loading={isLoading} hint="In period" />
        <StatsCard label="Revenue" value={formatCompactKES(k?.revenue)} icon={CreditCard} tone="green" loading={isLoading} hint="In period" />
        <StatsCard label="Listing sales" value={formatNumber(k?.listingSales)} icon={Package} tone="amber" loading={isLoading} hint="Paid listing packages" />
        <StatsCard label="Open reports" value={formatNumber(k?.openReports)} icon={Flag} tone="red" loading={isLoading} hint={<Link to="/admin/reports" className="font-medium text-teal-700 hover:underline">Moderate</Link>} />
        <StatsCard label="Vehicles sold" value={formatNumber(k?.soldVehicles)} icon={Gauge} tone="brand" loading={isLoading} hint="In period" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title="Listings published" />{data ? <TimeSeriesChart data={data.charts.listings} label="Listings published per day" valueLabel="Listings" /> : <Skeleton className="h-56" />}</Card>
        <Card><CardHeader title="New users" />{data ? <TimeSeriesChart data={data.charts.users} label="New users per day" valueLabel="Users" color="teal" /> : <Skeleton className="h-56" />}</Card>
        <Card><CardHeader title="Revenue" description="Successful payments, KES" />{data ? <TimeSeriesChart data={data.charts.revenue} label="Revenue per day" valueLabel="KES" format={formatKES} color="amber" /> : <Skeleton className="h-56" />}</Card>
        <Card>
          <CardHeader title="Most viewed vehicles" />
          {data ? (
            <ol className="divide-y divide-line text-sm">
              {data.mostViewed.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-muted tabular-nums">{i + 1}</span>
                  <Link to={`/vehicle/${v.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{v.title}</Link>
                  <span className="text-muted tabular-nums">{formatNumber(v.views)} views</span>
                </li>
              ))}
            </ol>
          ) : <Skeleton className="h-56" />}
        </Card>
        <Card><CardHeader title="Popular brands" description="By searches" /><BarList data={data?.popularBrands || []} label="Most searched brands" valueLabel="Searches" color="brand" /></Card>
        <Card><CardHeader title="Popular models" description="By searches" /><BarList data={data?.popularModels || []} label="Most searched models" valueLabel="Searches" /></Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Recent admin activity" action={<Link to="/admin/audit-logs" className="text-sm font-medium text-teal-700 hover:underline">Audit log</Link>} />
        <ul className="divide-y divide-line text-sm">
          {(data?.recent || []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Badge tone="neutral" className="font-mono">{a.action}</Badge>
              <span className="text-slate-600">{a.actorName}</span>
              <span className="ml-auto text-xs text-muted">{timeAgo(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(90)
  const { data, isLoading, error, refetch } = useOverview(days)
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const f = data?.funnel
  return (
    <>
      <Seo title="Analytics" noindex />
      <PageTitle title="Analytics" description="Demand, supply and conversion across the marketplace." action={<RangeSelect days={days} setDays={setDays} />} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatsCard label="Listings created" value={formatNumber(f?.created)} loading={isLoading} />
        <StatsCard label="Published" value={formatNumber(f?.published)} loading={isLoading} />
        <StatsCard label="Sold" value={formatNumber(f?.sold)} loading={isLoading} hint={f?.published ? `${Math.round((f.sold / f.published) * 100)}% of published` : undefined} />
        <StatsCard label="Payments started" value={formatNumber(f?.paymentsStarted)} loading={isLoading} />
        <StatsCard label="Payment conversion" value={f?.paymentsStarted ? `${Math.round((f.paymentsSucceeded / f.paymentsStarted) * 100)}%` : '—'} loading={isLoading} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2"><CardHeader title="Vehicle views" />{data ? <TimeSeriesChart data={data.charts.views} label="Vehicle views per day" valueLabel="Views" /> : <Skeleton className="h-56" />}</Card>
        <Card><CardHeader title="Most searched brands" /><BarList data={data?.popularBrands || []} label="Brands" valueLabel="Searches" color="brand" /></Card>
        <Card><CardHeader title="Most searched models" /><BarList data={data?.popularModels || []} label="Models" valueLabel="Searches" /></Card>
        <Card><CardHeader title="Popular price ranges" description="Max budget used in searches" /><BarList data={data?.popularPriceBands || []} label="Price ranges" valueLabel="Searches" color="amber" /></Card>
        <Card><CardHeader title="Popular body types" /><BarList data={data?.popularBodies || []} label="Body types" valueLabel="Searches" /></Card>
      </div>
      <h2 className="mt-8 mb-3 font-semibold">Dealer performance</h2>
      <DataTable
        loading={isLoading}
        rows={data?.dealerPerformance || []}
        columns={[
          { key: 'name', header: 'Dealer', render: (r) => <Link to={`/dealer/${r.slug}`} className="font-medium hover:underline">{r.name}</Link> },
          { key: 'verified', header: 'Status', hideOn: 'md', render: (r) => (r.verified ? <Badge tone="teal">Verified</Badge> : <Badge>Unverified</Badge>) },
          { key: 'active', header: 'Active', className: 'tabular-nums' },
          { key: 'sold', header: 'Sold', className: 'tabular-nums', hideOn: 'sm' },
          { key: 'views', header: 'Views', className: 'tabular-nums', render: (r) => formatNumber(r.views) },
          { key: 'leads', header: 'Leads', className: 'tabular-nums' },
          { key: 'conversion', header: 'Lead rate', render: (r) => `${r.conversion}%` },
        ]}
      />
      <h2 className="mt-8 mb-3 font-semibold">Top vehicles</h2>
      <DataTable
        loading={isLoading}
        rows={data?.mostViewed || []}
        columns={[
          { key: 'title', header: 'Vehicle', render: (r) => <Link to={`/vehicle/${r.slug}`} className="font-medium hover:underline">{r.title}</Link> },
          { key: 'price', header: 'Price', render: (r) => formatKES(r.price) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'views', header: 'Views', className: 'tabular-nums', render: (r) => formatNumber(r.views) },
        ]}
      />
      <p className="mt-6 text-xs text-muted"><Mail className="mr-1 inline size-3.5" aria-hidden="true" />Analytics events are tracked server-side (views, searches, saves, messages, phone/WhatsApp clicks, shares, listing lifecycle and payments).</p>
    </>
  )
}

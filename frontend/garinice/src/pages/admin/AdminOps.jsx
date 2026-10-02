import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertOctagon, Ban, Check, EyeOff, Mail, MessageSquare, Plus, RotateCcw, Trash2, TriangleAlert, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageTitle } from '../../components/layout/SideNavLayout'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, DataTable, StatsCard } from '../../components/ui/Data'
import { Alert, Badge, ErrorState, Skeleton, StatusBadge } from '../../components/ui/Feedback'
import { Field, Input, NumberInput, Select, Switch, Textarea } from '../../components/ui/Form'
import { Pagination, Tabs } from '../../components/ui/Navigation'
import { ConfirmDialog, Drawer } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { VehicleImage } from '../../components/vehicle/VehicleCard'
import { useAuth } from '../../hooks/useAuth'
import { Seo } from '../../hooks/useSeo'
import { useDebounce } from '../../hooks/useUtils'
import { PAYMENT_STATUSES, REPORT_REASONS } from '../../lib/constants'
import { formatDateTime, formatKES, timeAgo } from '../../lib/format'

// ---- Reports ------------------------------------------------------------------------
const REPORT_ACTIONS = {
  dismiss: { label: 'Dismiss', icon: X, title: 'Dismiss report', confirm: 'Dismiss' },
  warn_seller: { label: 'Warn seller', icon: TriangleAlert, title: 'Warn the seller', confirm: 'Send warning', note: 'Message to the seller' },
  suspend_listing: { label: 'Suspend listing', icon: EyeOff, title: 'Suspend this listing', confirm: 'Suspend listing', tone: 'danger', note: 'Note to the seller' },
  suspend_seller: { label: 'Suspend seller', icon: Ban, title: 'Suspend the seller’s account', confirm: 'Suspend seller', tone: 'danger', note: 'Internal reason' },
}

export function AdminReportsPage() {
  const [status, setStatus] = useState('OPEN')
  const [pending, setPending] = useState(null)
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-reports', status], queryFn: () => api.admin.reports({ status }) })
  const resolve = useMutation({
    mutationFn: ({ id, action, note }) => api.admin.resolveReport(id, action, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
      qc.invalidateQueries({ queryKey: ['admin-overview'] })
      toast.success('Report resolved')
      setPending(null)
    },
    onError: (e) => toast.error(e.message),
  })
  const a = pending && REPORT_ACTIONS[pending.action]
  return (
    <>
      <Seo title="Reports" noindex />
      <PageTitle title="Reports" description="Listings reported by buyers. Act on fraud quickly." />
      <Tabs className="mb-5" value={status} onChange={setStatus} tabs={[{ value: 'OPEN', label: 'Open', count: data?.counts?.OPEN }, { value: 'ACTIONED', label: 'Actioned' }, { value: 'DISMISSED', label: 'Dismissed' }, { value: 'ALL', label: 'All' }]} />
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Skeleton className="h-64 rounded-xl" /> : data.items.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted"><Check className="mx-auto mb-2 size-8 text-success" />No {status === 'ALL' ? '' : status.toLowerCase()} reports.</Card>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <Card as="li" key={r.id} padded={false} className="p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                {r.vehicle && <Link to={`/vehicle/${r.vehicle.slug}`} className="shrink-0"><VehicleImage image={r.vehicle.image} alt="" thumb className="aspect-[4/3] w-full rounded-lg md:w-40" /></Link>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger" icon={AlertOctagon}>{REPORT_REASONS.find((x) => x.value === r.reason)?.label}</Badge>
                    <StatusBadge status={r.status} kind="report" />
                    <span className="text-xs text-muted">{timeAgo(r.createdAt)} by {r.reporterName}</span>
                  </div>
                  {r.vehicle && <Link to={`/vehicle/${r.vehicle.slug}`} className="mt-2 block font-semibold hover:underline">{r.vehicle.title} · {formatKES(r.vehicle.price)}</Link>}
                  {r.vehicle && <p className="text-xs text-muted">Seller: {r.vehicle.sellerName}{r.vehicle.sellerSuspended && ' (suspended)'} · Listing: {r.vehicle.status.toLowerCase()}{r.vehicle.hiddenByAdmin && ' (hidden)'}</p>}
                  {r.details && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">“{r.details}”</p>}
                  {r.resolution && <p className="mt-2 text-xs text-muted">Resolution: {r.resolution.replace(/_/g, ' ')} by {r.resolvedByName} · {timeAgo(r.resolvedAt)}</p>}
                </div>
                {r.status === 'OPEN' && (
                  <div className="flex shrink-0 flex-wrap gap-2 md:w-44 md:flex-col">
                    {Object.entries(REPORT_ACTIONS).map(([key, x]) => (
                      <Button key={key} size="sm" variant={x.tone === 'danger' ? 'danger-ghost' : 'secondary'} icon={x.icon} onClick={() => (x.note ? setPending({ id: r.id, action: key }) : resolve.mutate({ id: r.id, action: key }))} className="justify-start">{x.label}</Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} title={a?.title} noteLabel={a?.note} tone={a?.tone} confirmLabel={a?.confirm} loading={resolve.isPending} onConfirm={(note) => resolve.mutate({ ...pending, note })} />
    </>
  )
}

// ---- Payments -----------------------------------------------------------------------
export function AdminPaymentsPage() {
  const [status, setStatus] = useState('ALL')
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [page, setPage] = useState(1)
  const [refund, setRefund] = useState(null)
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-payments', status, dq, page], queryFn: () => api.admin.payments({ status, q: dq, page }), placeholderData: keepPreviousData })
  const m = useMutation({
    mutationFn: (id) => api.admin.refund(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payments'] }); toast.success('Payment marked as refunded'); setRefund(null) },
    onError: (e) => toast.error(e.message),
  })
  const s = data?.summary
  return (
    <>
      <Seo title="Payments" noindex />
      <PageTitle title="Payments" description="All gateway transactions. Statuses only change via verified webhooks." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Revenue (30 days)" value={formatKES(s?.revenue30)} loading={!s} tone="green" />
        <StatsCard label="Revenue (all time)" value={formatKES(s?.revenueAll)} loading={!s} />
        <StatsCard label="Failed (30 days)" value={s?.failed30} loading={!s} tone="red" />
        <StatsCard label="In progress" value={s?.pending} loading={!s} tone="amber" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input size="sm" aria-label="Search payments" placeholder="Reference, receipt or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-72" />
        <Select size="sm" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-44"><option value="ALL">All statuses</option>{Object.entries(PAYMENT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          columns={[
            { key: 'createdAt', header: 'Date', render: (r) => <span className="text-xs whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
            { key: 'reference', header: 'Reference', render: (r) => <span><span className="block font-mono text-xs">{r.reference}</span>{r.receipt && <span className="font-mono text-xs text-muted">{r.receipt}</span>}</span> },
            { key: 'user', header: 'User', hideOn: 'md', render: (r) => <span className="text-sm">{r.userName}<span className="block text-xs text-muted">{r.userEmail}</span></span> },
            { key: 'purpose', header: 'Purpose', hideOn: 'lg', render: (r) => <span className="text-sm">{r.package?.name}{r.vehicle && <span className="block max-w-48 truncate text-xs text-muted">{r.vehicle.title}</span>}</span> },
            { key: 'amount', header: 'Amount', className: 'tabular-nums whitespace-nowrap', render: (r) => formatKES(r.amount) },
            { key: 'gateway', header: 'Gateway', hideOn: 'xl', render: (r) => <span className="text-xs">{r.gateway}<span className="block font-mono text-muted">{r.gatewayRef?.slice(0, 16)}</span></span> },
            { key: 'status', header: 'Status', render: (r) => <span title={r.failureReason || undefined}><StatusBadge status={r.status} kind="payment" /></span> },
            { key: 'a', header: <span className="sr-only">Actions</span>, render: (r) => r.status === 'SUCCESS' && <Button size="xs" variant="ghost" icon={Undo2} onClick={() => setRefund(r)}>Refund</Button> },
          ]}
        />
      )}
      {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={setPage} />}
      <ConfirmDialog open={!!refund} onClose={() => setRefund(null)} tone="danger" title="Mark payment as refunded?" description={`${refund?.reference} · ${formatKES(refund?.amount)}. Process the reversal in the M-Pesa portal, then record it here.`} confirmLabel="Mark refunded" loading={m.isPending} onConfirm={() => m.mutate(refund.id)} />
    </>
  )
}

// ---- Messages -----------------------------------------------------------------------
export function AdminMessagesPage() {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-convos', dq, page], queryFn: () => api.admin.conversations({ q: dq, page }), placeholderData: keepPreviousData })
  const thread = useQuery({ queryKey: ['admin-convo', open?.id], queryFn: () => api.admin.conversation(open.id), enabled: !!open })
  const remove = useMutation({
    mutationFn: (id) => api.admin.removeMessage(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-convo'] }); toast.success('Message removed') },
  })
  return (
    <>
      <Seo title="Messages" noindex />
      <PageTitle title="Messages" description="Conversation oversight for abuse and fraud investigations. Opening a conversation is recorded in the audit log." />
      <Input size="sm" aria-label="Search conversations" placeholder="Search by vehicle, buyer or seller" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          onRowClick={setOpen}
          columns={[
            { key: 'vehicleTitle', header: 'Vehicle', render: (r) => <span className="font-medium">{r.vehicleTitle}</span> },
            { key: 'people', header: 'Participants', render: (r) => <span className="text-sm">{r.buyerName} → {r.sellerName}</span> },
            { key: 'lastMessagePreview', header: 'Last message', hideOn: 'lg', render: (r) => <span className="line-clamp-1 max-w-xs text-xs text-muted">{r.lastMessagePreview}</span> },
            { key: 'messageCount', header: 'Msgs', hideOn: 'md', className: 'tabular-nums' },
            { key: 'lastMessageAt', header: 'Last activity', render: (r) => <span className="text-xs text-muted">{timeAgo(r.lastMessageAt)}</span> },
          ]}
        />
      )}
      {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={setPage} />}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.vehicleTitle || 'Conversation'} width="max-w-xl">
        <div className="space-y-3 p-5">
          {thread.isLoading ? <Skeleton className="h-40" /> : thread.data?.messages.map((m) => (
            <div key={m.id} className={`rounded-xl border p-3 text-sm ${m.deletedAt ? 'border-dashed opacity-60' : 'border-line'} ${m.fromBuyer ? 'bg-white' : 'bg-brand-50'}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                <span><strong className="text-ink">{m.senderName}</strong> · {m.fromBuyer ? 'buyer' : 'seller'} · {formatDateTime(m.createdAt)}</span>
                {!m.deletedAt ? <button type="button" onClick={() => remove.mutate(m.id)} className="inline-flex items-center gap-1 text-danger hover:underline"><Trash2 className="size-3.5" />Remove</button> : <Badge>Removed</Badge>}
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </div>
      </Drawer>
    </>
  )
}

// ---- Homepage ----------------------------------------------------------------------
function HomepageForm({ initial }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [h, setH] = useState(initial)
  const save = useMutation({
    mutationFn: () => api.admin.updateSettings({ homepage: h }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); qc.invalidateQueries({ queryKey: ['home'] }); toast.success('Homepage updated') },
    onError: (e) => toast.error(e.message),
  })
  const setItem = (i, k, v) => setH((x) => ({ ...x, popularSearches: x.popularSearches.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }))
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Hero" />
        <div className="grid gap-4">
          <Field label="Headline">{(p) => <Input {...p} value={h.heroTitle} onChange={(e) => setH({ ...h, heroTitle: e.target.value })} maxLength={80} />}</Field>
          <Field label="Supporting text">{(p) => <Textarea {...p} value={h.heroSubtitle} onChange={(e) => setH({ ...h, heroSubtitle: e.target.value })} rows={2} maxLength={200} />}</Field>
          <Field label="Announcement banner" optional hint="Leave empty to hide. Plain text only.">{(p) => <Input {...p} value={h.announcement} onChange={(e) => setH({ ...h, announcement: e.target.value })} maxLength={200} />}</Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Popular searches" description="Quick links under the hero search. Links must be site paths starting with /." action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setH({ ...h, popularSearches: [...h.popularSearches, { label: '', href: '/cars?' }] })} disabled={h.popularSearches.length >= 16}>Add link</Button>} />
        <ul className="space-y-2">
          {h.popularSearches.map((p, i) => (
            <li key={i} className="flex gap-2">
              <Input size="sm" aria-label={`Label ${i + 1}`} value={p.label} onChange={(e) => setItem(i, 'label', e.target.value)} placeholder="Label" className="w-48" />
              <Input size="sm" aria-label={`Link ${i + 1}`} value={p.href} onChange={(e) => setItem(i, 'href', e.target.value)} placeholder="/cars?make=toyota" className="flex-1 font-mono text-xs" />
              <Button size="icon-sm" variant="danger-ghost" aria-label={`Remove ${p.label || 'link'}`} onClick={() => setH({ ...h, popularSearches: h.popularSearches.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      </Card>
      <Alert tone="info">Featured cars on the homepage come from <Link to="/admin/promotions" className="font-medium underline">promotions</Link> and paid Featured packages.</Alert>
      <div className="flex justify-end gap-3"><Button variant="secondary" to="/" target="_blank">Preview homepage</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Publish changes</Button></div>
    </div>
  )
}

export function AdminHomepagePage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-settings'], queryFn: api.admin.settings })
  return (
    <>
      <Seo title="Homepage" noindex />
      <PageTitle title="Homepage" description="Manage hero copy, announcements and quick links." />
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Skeleton className="h-96 rounded-xl" /> : <HomepageForm initial={data.settings.homepage} />}
    </>
  )
}

// ---- Audit logs ---------------------------------------------------------------------
export function AdminAuditLogsPage() {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['audit', dq, entity, page], queryFn: () => api.admin.auditLogs({ q: dq, entity, page }), placeholderData: keepPreviousData })
  return (
    <>
      <Seo title="Audit logs" noindex />
      <PageTitle title="Audit logs" description="Immutable record of sensitive actions." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input size="sm" aria-label="Search logs" placeholder="Action, actor or ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-72" />
        <Select size="sm" aria-label="Entity" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} className="w-44">
          <option value="">All entities</option>
          {['vehicle', 'user', 'dealer', 'payment', 'report', 'brand', 'model', 'package', 'promotion', 'cms_page', 'seo_record', 'settings', 'conversation', 'message', 'system'].map((e) => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
        </Select>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          columns={[
            { key: 'createdAt', header: 'Time', render: (r) => <span className="text-xs whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
            { key: 'action', header: 'Action', render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.action}</code> },
            { key: 'actor', header: 'Actor', render: (r) => <span className="text-sm">{r.actorName}<span className="block text-xs text-muted">{r.actorEmail}</span></span> },
            { key: 'entity', header: 'Entity', hideOn: 'md', render: (r) => <span className="text-xs">{r.entityType}<span className="block font-mono text-muted">{r.entityId?.slice(0, 8)}</span></span> },
            { key: 'meta', header: 'Details', hideOn: 'lg', render: (r) => r.meta && <code className="line-clamp-2 max-w-xs text-[11px] break-all text-muted">{JSON.stringify(r.meta)}</code> },
            { key: 'ip', header: 'IP', hideOn: 'xl', render: (r) => <span className="font-mono text-xs text-muted">{r.ip}</span> },
          ]}
        />
      )}
      {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={setPage} />}
    </>
  )
}

// ---- Settings -----------------------------------------------------------------------
function SettingsForm({ initial }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const [s, setS] = useState(initial)
  const [resetOpen, setResetOpen] = useState(false)
  const save = useMutation({
    mutationFn: () => api.admin.updateSettings(s),
    onSuccess: (res) => { setS(res.settings); qc.invalidateQueries({ queryKey: ['admin-settings'] }); toast.success('Settings saved') },
    onError: (e) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: api.admin.resetDemo,
    onSuccess: () => { toast.success('Demo data reset'); setTimeout(() => window.location.assign('/'), 800) },
    onError: (e) => toast.error(e.message),
  })
  const outbox = useQuery({ queryKey: ['outbox'], queryFn: () => api.admin.outbox({ page: 1 }) })
  const contact = useQuery({ queryKey: ['contact-messages'], queryFn: api.admin.contactMessages })
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Moderation" />
        <div className="space-y-4">
          <Switch label="Require review before listings go live" checked={s.moderationRequired} onChange={(v) => setS({ ...s, moderationRequired: v })} />
          <Switch label="Auto-approve verified dealers" description="Listings from verified dealers skip the review queue." checked={s.autoApproveVerifiedDealers} onChange={(v) => setS({ ...s, autoApproveVerifiedDealers: v })} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Listing limits" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Free listings per private seller">{(p) => <NumberInput {...p} value={String(s.privateFreeListings)} onChange={(v) => setS({ ...s, privateFreeListings: v })} />}</Field>
          <Field label="Free listings per dealer">{(p) => <NumberInput {...p} value={String(s.dealerFreeListings)} onChange={(v) => setS({ ...s, dealerFreeListings: v })} />}</Field>
          <Field label="Default listing duration">{(p) => <NumberInput {...p} value={String(s.listingDurationDays)} onChange={(v) => setS({ ...s, listingDurationDays: v })} suffix="days" />}</Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Payment methods" description="Gateways are pluggable. Only enable methods with live credentials configured server-side." />
        <div className="space-y-4">
          <Switch label="M-Pesa (Daraja STK push)" checked={s.payments.MPESA} onChange={(v) => setS({ ...s, payments: { ...s.payments, MPESA: v } })} />
          <Switch label="Card" checked={s.payments.CARD} onChange={(v) => setS({ ...s, payments: { ...s.payments, CARD: v } })} />
          <Switch label="Bank transfer" checked={s.payments.BANK} onChange={(v) => setS({ ...s, payments: { ...s.payments, BANK: v } })} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Maintenance" />
        <Switch label="Maintenance mode" description="Public API returns 503 for everyone except admins." checked={s.maintenanceMode} onChange={(v) => setS({ ...s, maintenanceMode: v })} />
      </Card>
      <div className="flex justify-end"><Button loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button></div>

      <Card>
        <CardHeader title="Notification outbox" description="Email / SMS / WhatsApp deliveries queued for the worker." />
        <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
          {(outbox.data?.items || []).slice(0, 30).map((o) => (
            <li key={o.id} className="flex items-start gap-3 py-2">
              {o.channel === 'EMAIL' ? <Mail className="mt-0.5 size-4 text-slate-400" /> : <MessageSquare className="mt-0.5 size-4 text-slate-400" />}
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{o.subject}</span><span className="text-xs text-muted">{o.channel} → {o.to}</span></span>
              <span className="text-xs text-muted">{timeAgo(o.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Contact form messages" />
        {contact.data?.items?.length ? (
          <ul className="divide-y divide-line text-sm">{contact.data.items.map((c) => <li key={c.id} className="py-2.5"><p className="font-medium">{c.subject} <span className="font-normal text-muted">— {c.name} ({c.email})</span></p><p className="text-slate-600">{c.message}</p><p className="text-xs text-muted">{timeAgo(c.createdAt)}</p></li>)}</ul>
        ) : <p className="text-sm text-muted">No messages yet.</p>}
      </Card>
      {user.role === 'SUPER_ADMIN' && (
        <Card className="border-red-200">
          <CardHeader title="Reset demo data" description="Restores the seeded demo marketplace. Removes all changes made in this browser." />
          <Button variant="danger" icon={RotateCcw} onClick={() => setResetOpen(true)}>Reset demo data</Button>
        </Card>
      )}
      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} tone="danger" title="Reset all demo data?" description="Every listing, user, message and payment created since seeding will be removed." confirmLabel="Reset" loading={reset.isPending} onConfirm={() => reset.mutate()} />
    </div>
  )
}

export function AdminSettingsPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-settings'], queryFn: api.admin.settings })
  return (
    <>
      <Seo title="Settings" noindex />
      <PageTitle title="System settings" />
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Skeleton className="h-96 rounded-xl" /> : <SettingsForm initial={data.settings} />}
    </>
  )
}

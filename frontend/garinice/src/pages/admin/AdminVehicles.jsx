import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, Eye, EyeOff, FileText, Flag, MessageSquareWarning, MoreHorizontal, Pencil, Sparkles, Star, Trash2, UserCog, XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { PageTitle } from '../../components/layout/SideNavLayout'
import { Button } from '../../components/ui/Button'
import { DataTable, Menu } from '../../components/ui/Data'
import { Alert, Badge, ErrorState, Skeleton, StatusBadge } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Form'
import { Pagination, Tabs } from '../../components/ui/Navigation'
import { ConfirmDialog, Drawer, Modal } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { Gallery } from '../../components/vehicle/Gallery'
import { VehicleImage } from '../../components/vehicle/VehicleCard'
import { useTaxonomy } from '../../hooks/queries'
import { Seo } from '../../hooks/useSeo'
import { useDebounce } from '../../hooks/useUtils'
import { LISTING_STATUSES, REPORT_REASONS } from '../../lib/constants'
import { formatDateTime, formatKES, formatNumber, timeAgo } from '../../lib/format'

const NOTE_ACTIONS = {
  reject: { title: 'Reject listing', label: 'Reason for rejection', required: true, confirm: 'Reject', tone: 'danger', placeholder: 'e.g. Photos appear to be stock images. Please upload real photos.' },
  request_changes: { title: 'Request changes', label: 'What should the seller change?', required: true, confirm: 'Send request', placeholder: 'e.g. Please add photos of the interior and dashboard.' },
  hide: { title: 'Hide listing', label: 'Internal note', required: false, confirm: 'Hide listing', tone: 'danger' },
  delete: { title: 'Delete listing', label: 'Internal note', required: false, confirm: 'Delete', tone: 'danger' },
  pause: { title: 'Pause listings', label: 'Internal note', required: false, confirm: 'Pause', tone: 'danger' },
}

function VehicleDetailDrawer({ id, onClose, onAction }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin-vehicle', id], queryFn: () => api.admin.vehicle(id), enabled: !!id })
  const v = data?.vehicle
  return (
    <Drawer open={!!id} onClose={onClose} title="Listing details" width="max-w-2xl">
      {isLoading || !v ? <div className="space-y-3 p-5"><Skeleton className="aspect-[4/3]" /><Skeleton className="h-6 w-2/3" /></div> : (
        <div className="space-y-6 p-5">
          <Gallery images={v.images} title={v.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={v.status} />{v.hiddenByAdmin && <Badge tone="danger">Hidden by admin</Badge>}{v.featured && <Badge tone="accent">Featured</Badge>}</div>
            <h3 className="mt-2 text-xl font-bold">{v.title}</h3>
            <p className="font-display text-lg font-bold text-brand-700">{formatKES(v.price)}</p>
            <p className="mt-1 text-sm text-muted">Ref {v.ref} · {v.sellerName} ({v.sellerEmail}) · {v.sellerType}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {v.status === 'PENDING_REVIEW' && <><Button size="sm" variant="teal" icon={CheckCircle2} onClick={() => onAction(v, 'approve')}>Approve</Button><Button size="sm" variant="secondary" icon={MessageSquareWarning} onClick={() => onAction(v, 'request_changes')}>Request changes</Button><Button size="sm" variant="danger" icon={XCircle} onClick={() => onAction(v, 'reject')}>Reject</Button></>}
            <Button size="sm" variant="secondary" icon={Pencil} to={`/sell/vehicle?edit=${v.id}`}>Edit</Button>
            <Button size="sm" variant="secondary" icon={Eye} to={`/vehicle/${v.slug}`}>Open page</Button>
          </div>
          {v.sellerType === 'AGENT' && (
            <Alert tone={v.authorityDocUrl ? 'info' : 'warning'} title="Authority to Sell">
              {v.authorityDocUrl ? <a href={v.authorityDocUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline"><FileText className="size-4" aria-hidden="true" />Open document</a> : 'No document attached.'}
            </Alert>
          )}
          <div>
            <h4 className="mb-2 font-semibold">Description</h4>
            <p className="text-sm whitespace-pre-line text-slate-700">{v.description}</p>
          </div>
          {data.reports.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-semibold"><Flag className="size-4 text-danger" aria-hidden="true" />Reports ({data.reports.length})</h4>
              <ul className="space-y-2 text-sm">{data.reports.map((r) => <li key={r.id} className="rounded-lg bg-red-50 p-3"><strong>{REPORT_REASONS.find((x) => x.value === r.reason)?.label}</strong> · {r.status.toLowerCase()} · {timeAgo(r.createdAt)}{r.details && <p className="mt-1 text-slate-700">{r.details}</p>}</li>)}</ul>
            </div>
          )}
          <div>
            <h4 className="mb-2 font-semibold">Moderation history</h4>
            {data.moderation.length === 0 ? <p className="text-sm text-muted">No moderation events yet.</p> : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {data.moderation.map((m) => (
                  <li key={m.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-teal-600" aria-hidden="true" />
                    <p><strong>{m.action.replace(/_/g, ' ').toLowerCase()}</strong> → {LISTING_STATUSES[m.status]?.label || m.status}</p>
                    <p className="text-xs text-muted">{m.byName} · {formatDateTime(m.at)}</p>
                    {m.note && <p className="mt-1 rounded bg-slate-50 p-2 text-slate-700">{m.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

function ChangeSellerDialog({ vehicle, onClose }) {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 250)
  const qc = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({ queryKey: ['admin-sellers', dq], queryFn: () => api.admin.sellers(dq), enabled: !!vehicle })
  const m = useMutation({
    mutationFn: (sellerId) => api.admin.changeSeller(vehicle.id, sellerId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-vehicles'] }); toast.success('Seller changed'); onClose() },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Modal open={!!vehicle} onClose={onClose} title="Change seller" description={vehicle?.title}>
      <Input placeholder="Search sellers by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sellers" data-autofocus />
      <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {(data?.items || []).map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span><span className="block font-medium">{u.name}</span><span className="text-xs text-muted">{u.email} · {u.role}</span></span>
            <Button size="xs" variant="secondary" loading={m.isPending && m.variables === u.id} onClick={() => m.mutate(u.id)}>Assign</Button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/** Vehicle management + moderation queue (same screen, different default filter). */
export function AdminVehiclesPage({ queue = false }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || (queue ? 'PENDING_REVIEW' : 'ALL')
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [make, setMake] = useState('')
  const [sellerType, setSellerType] = useState('')
  const [selected, setSelected] = useState([])
  const [detail, setDetail] = useState(null)
  const [noteAction, setNoteAction] = useState(null) // { ids, action, title }
  const [changeSeller, setChangeSeller] = useState(null)
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: tax } = useTaxonomy()
  const query = { status, q: dq, make, sellerType, page, pageSize: 25 }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-vehicles', query], queryFn: () => api.admin.vehicles(query), placeholderData: keepPreviousData })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-vehicles'] })
    qc.invalidateQueries({ queryKey: ['admin-vehicle'] })
    qc.invalidateQueries({ queryKey: ['admin-overview'] })
    qc.invalidateQueries({ queryKey: ['vehicles'] })
  }
  const single = useMutation({
    mutationFn: ({ id, action, note }) => (action === 'mark_sold' ? api.vehicles.setStatus(id, 'mark_sold') : api.admin.moderate(id, action, note)),
    onSuccess: (_r, { action }) => { refresh(); toast.success(`Listing ${action.replace('_', ' ')} done`); setNoteAction(null) },
    onError: (e) => toast.error('Action failed', { description: e.message }),
  })
  const bulk = useMutation({
    mutationFn: ({ ids, action, note }) => api.admin.bulk(ids, action, note),
    onSuccess: (res) => {
      refresh()
      setSelected([])
      setNoteAction(null)
      if (res.failed.length) toast.warning(`${res.ok} updated, ${res.failed.length} skipped`, { description: res.failed.slice(0, 3).map((f) => `${f.title}: ${f.reason}`).join(' · ') })
      else toast.success(`${res.ok} listings updated`)
    },
    onError: (e) => toast.error(e.message),
  })
  const run = (ids, action) => {
    if (NOTE_ACTIONS[action]) return setNoteAction({ ids, action })
    if (ids.length === 1 && !selected.length) single.mutate({ id: ids[0], action })
    else bulk.mutate({ ids, action })
  }
  const onVehicleAction = (v, action) => run([v.id], action)
  const counts = data?.counts || {}
  const statusTabs = ['ALL', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'DRAFT', 'REJECTED', 'SOLD', 'EXPIRED'].map((s) => ({ value: s, label: s === 'ALL' ? 'All' : LISTING_STATUSES[s].label, count: counts[s] || 0 }))
  const na = noteAction && NOTE_ACTIONS[noteAction.action]

  const menu = (v) => [
    { label: 'Details & history', icon: Eye, onClick: () => setDetail(v.id) },
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/sell/vehicle?edit=${v.id}`) },
    ['PENDING_REVIEW', 'REJECTED', 'DRAFT'].includes(v.status) && { label: 'Approve', icon: CheckCircle2, onClick: () => run([v.id], 'approve') },
    ['PENDING_REVIEW', 'PUBLISHED'].includes(v.status) && { label: 'Request changes', icon: MessageSquareWarning, onClick: () => run([v.id], 'request_changes') },
    ['PENDING_REVIEW', 'PUBLISHED', 'PAUSED'].includes(v.status) && { label: 'Reject', icon: XCircle, onClick: () => run([v.id], 'reject') },
    v.status === 'PUBLISHED' && !v.featured && { label: 'Feature (14 days)', icon: Star, onClick: () => run([v.id], 'feature') },
    v.featured && { label: 'Remove feature', icon: Star, onClick: () => run([v.id], 'unfeature') },
    ['PUBLISHED', 'PENDING_REVIEW'].includes(v.status) && { label: 'Hide', icon: EyeOff, onClick: () => run([v.id], 'hide') },
    v.status === 'PAUSED' && v.hiddenByAdmin && { label: 'Unhide', icon: Eye, onClick: () => run([v.id], 'unhide') },
    ['PUBLISHED', 'PAUSED'].includes(v.status) && { label: 'Mark sold', icon: CheckCircle2, onClick: () => single.mutate({ id: v.id, action: 'mark_sold' }) },
    { label: 'Change seller', icon: UserCog, onClick: () => setChangeSeller(v) },
    { divider: true },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => run([v.id], 'delete') },
  ]

  return (
    <>
      <Seo title={queue ? 'Listing moderation' : 'Vehicles'} noindex />
      <PageTitle title={queue ? 'Listing moderation' : 'Vehicles'} description={queue ? 'Review new and edited listings before they go live. Oldest first.' : 'Every vehicle on the marketplace, in every state.'} action={<Button variant="secondary" to="/sell/vehicle">Create vehicle</Button>} />
      <Tabs tabs={statusTabs} value={status} onChange={(s) => { setParams(s === 'ALL' ? {} : { status: s }); setSelected([]) }} className="mb-4" />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input size="sm" aria-label="Search vehicles" placeholder="Search title, ref, seller or dealer" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
        <Select size="sm" aria-label="Make" value={make} onChange={(e) => setMake(e.target.value)} className="w-40"><option value="">All makes</option>{(tax?.brands || []).map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</Select>
        <Select size="sm" aria-label="Seller type" value={sellerType} onChange={(e) => setSellerType(e.target.value)} className="w-44"><option value="">All sellers</option><option value="DEALER">Dealers</option><option value="PRIVATE">Private sellers</option><option value="AGENT">Agents</option></Select>
      </div>
      {selected.length > 0 && (
        <div className="sticky top-20 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 shadow-card">
          <span className="mr-2 text-sm font-semibold text-teal-900">{selected.length} selected</span>
          <Button size="xs" variant="teal" icon={CheckCircle2} onClick={() => run(selected, 'approve')}>Approve</Button>
          <Button size="xs" variant="secondary" icon={XCircle} onClick={() => run(selected, 'reject')}>Reject</Button>
          <Button size="xs" variant="secondary" icon={EyeOff} onClick={() => run(selected, 'pause')}>Pause</Button>
          <Button size="xs" variant="secondary" icon={Sparkles} onClick={() => run(selected, 'feature')}>Feature</Button>
          <Button size="xs" variant="danger" icon={Trash2} onClick={() => run(selected, 'delete')}>Delete</Button>
          <button type="button" className="ml-auto text-sm text-teal-800 underline" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          selectable
          selected={selected}
          onSelect={setSelected}
          loading={isLoading}
          rows={data?.items || []}
          onRowClick={(r) => setDetail(r.id)}
          empty={queue ? '🎉 The moderation queue is empty.' : 'No vehicles match these filters.'}
          columns={[
            { key: 'title', header: 'Vehicle', render: (v) => (
              <div className="flex items-center gap-3">
                <VehicleImage image={v.image} alt="" thumb className="h-12 w-16 shrink-0 rounded-md" />
                <div className="min-w-0">
                  <p className="max-w-64 truncate font-medium">{v.title}</p>
                  <p className="text-xs text-muted">Ref {v.ref} · {formatKES(v.price)}</p>
                </div>
              </div>
            ) },
            { key: 'seller', header: 'Seller', hideOn: 'md', render: (v) => <span className="text-sm"><span className="block">{v.dealerName || v.sellerName}</span><span className="text-xs text-muted">{v.sellerType.toLowerCase()}</span></span> },
            { key: 'status', header: 'Status', render: (v) => (
              <div className="flex flex-col items-start gap-1">
                <StatusBadge status={v.status} />
                {v.featured && <Badge tone="accent">Featured</Badge>}
                {v.hiddenByAdmin && <Badge tone="danger">Hidden</Badge>}
                {v.reports > 0 && <Badge tone="danger" icon={Flag}>{v.reports}</Badge>}
              </div>
            ) },
            { key: 'views', header: 'Views', hideOn: 'lg', className: 'tabular-nums', render: (v) => formatNumber(v.views) },
            { key: 'updatedAt', header: 'Updated', hideOn: 'xl', render: (v) => <span className="text-xs whitespace-nowrap text-muted">{timeAgo(v.updatedAt)}</span> },
            { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (v) => (
              <div className="flex items-center justify-end gap-1.5">
                {v.status === 'PENDING_REVIEW' && <Button size="xs" variant="teal" onClick={() => run([v.id], 'approve')} loading={single.isPending && single.variables?.id === v.id}>Approve</Button>}
                <Menu trigger={(p) => <Button variant="ghost" size="icon-sm" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu" aria-label={`Actions for ${v.title}`}><MoreHorizontal className="size-4" /></Button>} items={menu(v)} />
              </div>
            ) },
          ]}
        />
      )}
      {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={(p) => { const n = new URLSearchParams(params); n.set('page', p); setParams(n) }} />}
      <p className="mt-3 text-center text-xs text-muted">{data && `${formatNumber(data.total)} vehicles`} · <Link to="/admin/reports" className="hover:underline">Open reports</Link></p>

      <VehicleDetailDrawer id={detail} onClose={() => setDetail(null)} onAction={onVehicleAction} />
      <ChangeSellerDialog vehicle={changeSeller} onClose={() => setChangeSeller(null)} />
      <ConfirmDialog
        open={!!noteAction}
        onClose={() => setNoteAction(null)}
        title={`${na?.title || ''}${noteAction?.ids.length > 1 ? ` (${noteAction.ids.length})` : ''}`}
        description={na?.required ? 'The seller will be notified with your note.' : 'This is logged in the audit trail.'}
        noteLabel={na?.label}
        noteRequired={na?.required}
        notePlaceholder={na?.placeholder}
        confirmLabel={na?.confirm}
        tone={na?.tone}
        loading={single.isPending || bulk.isPending}
        onConfirm={(note) => {
          const { ids, action } = noteAction
          if (ids.length === 1 && !selected.length && action !== 'pause') single.mutate({ id: ids[0], action, note })
          else bulk.mutate({ ids, action, note })
        }}
      />
    </>
  )
}

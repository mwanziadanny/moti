import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Ban, ExternalLink, MoreHorizontal, RotateCcw, ShieldCheck, UserCog } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageTitle } from '../../components/layout/SideNavLayout'
import { Button } from '../../components/ui/Button'
import { Avatar, DataTable, Menu } from '../../components/ui/Data'
import { Badge, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select } from '../../components/ui/Form'
import { Pagination } from '../../components/ui/Navigation'
import { ConfirmDialog, Modal } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { Seo } from '../../hooks/useSeo'
import { useDebounce } from '../../hooks/useUtils'
import { ROLE_LABELS, ROLES } from '../../lib/constants'
import { formatDate, timeAgo } from '../../lib/format'

export function AdminUsersPage({ sellersOnly = false }) {
  const { user: me } = useAuth()
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [role, setRole] = useState(sellersOnly ? 'PRIVATE_SELLER' : '')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState(null)
  const [roleEdit, setRoleEdit] = useState(null)
  const qc = useQueryClient()
  const toast = useToast()
  const query = { q: dq, role, status, page }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-users', query], queryFn: () => api.admin.users(query), placeholderData: keepPreviousData })
  const update = useMutation({
    mutationFn: ({ id, body }) => api.admin.updateUser(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated'); setConfirm(null); setRoleEdit(null) },
    onError: (e) => toast.error(e.message),
  })
  const roleOptions = sellersOnly ? ['PRIVATE_SELLER', 'DEALER', 'DEALER_STAFF'] : Object.values(ROLES)
  return (
    <>
      <Seo title={sellersOnly ? 'Sellers' : 'Users'} noindex />
      <PageTitle title={sellersOnly ? 'Sellers' : 'Users'} description={sellersOnly ? 'Private sellers and dealer accounts. Verify sellers after checking their ID.' : 'All registered accounts.'} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input size="sm" aria-label="Search users" placeholder="Search name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-72" />
        <Select size="sm" aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} className="w-44">
          {!sellersOnly && <option value="">All roles</option>}
          {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Select size="sm" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-40">
          <option value="">Any status</option><option value="verified">Verified</option><option value="suspended">Suspended</option>
        </Select>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          columns={[
            { key: 'name', header: 'User', render: (u) => (
              <span className="flex items-center gap-3"><Avatar name={u.name} size="sm" />
                <span className="min-w-0"><span className="flex items-center gap-1 font-medium">{u.name}{u.verified && <BadgeCheck className="size-4 text-teal-600" aria-label="Verified" />}</span><span className="block truncate text-xs text-muted">{u.email}</span></span>
              </span>
            ) },
            { key: 'role', header: 'Role', render: (u) => <span><Badge tone={['ADMIN', 'SUPER_ADMIN'].includes(u.role) ? 'brand' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge>{u.dealerName && <span className="mt-1 block text-xs text-muted">{u.dealerName}</span>}</span> },
            { key: 'listings', header: 'Listings', hideOn: 'md', className: 'tabular-nums' },
            { key: 'status', header: 'Status', render: (u) => (u.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>) },
            { key: 'createdAt', header: 'Joined', hideOn: 'lg', render: (u) => <span className="text-xs text-muted">{formatDate(u.createdAt)}<br />Last seen {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</span> },
            { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (u) => u.id !== me.id && (
              <Menu trigger={(p) => <Button variant="ghost" size="icon-sm" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu" aria-label={`Actions for ${u.name}`}><MoreHorizontal className="size-4" /></Button>} items={[
                { label: u.verified ? 'Remove verification' : 'Verify seller', icon: ShieldCheck, onClick: () => update.mutate({ id: u.id, body: { verified: !u.verified } }) },
                u.suspended ? { label: 'Reinstate account', icon: RotateCcw, onClick: () => update.mutate({ id: u.id, body: { suspended: false } }) } : { label: 'Suspend account', icon: Ban, danger: true, onClick: () => setConfirm(u) },
                me.role === 'SUPER_ADMIN' && { label: 'Change role', icon: UserCog, onClick: () => setRoleEdit({ ...u, newRole: u.role }) },
              ]} />
            ) },
          ]}
        />
      )}
      {data && <Pagination className="mt-4" page={data.page} pageCount={data.pageCount} onChange={setPage} />}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} tone="danger" title={`Suspend ${confirm?.name}?`} description="They will be signed out immediately and their published listings will be hidden." noteLabel="Reason (internal)" confirmLabel="Suspend" loading={update.isPending} onConfirm={(reason) => update.mutate({ id: confirm.id, body: { suspended: true, reason } })} />
      <Modal open={!!roleEdit} onClose={() => setRoleEdit(null)} title="Change role" description={roleEdit?.email} size="sm" footer={<><Button variant="secondary" onClick={() => setRoleEdit(null)}>Cancel</Button><Button loading={update.isPending} onClick={() => update.mutate({ id: roleEdit.id, body: { role: roleEdit.newRole } })}>Save role</Button></>}>
        <Field label="Role">{(p) => <Select {...p} value={roleEdit?.newRole || ''} onChange={(e) => setRoleEdit((r) => ({ ...r, newRole: e.target.value }))}>{Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>}</Field>
        <p className="mt-3 text-xs text-muted">Role changes take effect on the user’s next request and are recorded in the audit log.</p>
      </Modal>
    </>
  )
}

export function AdminDealersPage() {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [status, setStatus] = useState('')
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-dealers', dq, status], queryFn: () => api.admin.dealers({ q: dq, status }) })
  const update = useMutation({
    mutationFn: ({ id, body }) => api.admin.updateDealer(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-dealers'] }); toast.success('Dealer updated') },
    onError: (e) => toast.error(e.message),
  })
  return (
    <>
      <Seo title="Dealers" noindex />
      <PageTitle title="Dealers" description="Verify dealerships only after checking business registration and premises." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input size="sm" aria-label="Search dealers" placeholder="Search dealers" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
        <Select size="sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48"><option value="">All dealers</option><option value="unverified">Awaiting verification</option><option value="suspended">Suspended</option></Select>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          columns={[
            { key: 'name', header: 'Dealer', render: (d) => <span className="flex items-center gap-3"><Avatar src={d.logoUrl} name={d.name} square size="sm" /><span><span className="block font-medium">{d.name}</span><span className="text-xs text-muted">{d.town} · owner {d.ownerName}</span></span></span> },
            { key: 'status', header: 'Status', render: (d) => <span className="flex flex-col items-start gap-1">{d.verified ? <Badge tone="teal" icon={BadgeCheck}>Verified</Badge> : <Badge tone="warning">Unverified</Badge>}{d.suspended && <Badge tone="danger">Suspended</Badge>}</span> },
            { key: 'active', header: 'Listings', hideOn: 'md', render: (d) => <span className="tabular-nums">{d.active} active / {d.total}</span> },
            { key: 'staff', header: 'Staff', hideOn: 'lg', className: 'tabular-nums' },
            { key: 'package', header: 'Package', hideOn: 'lg', render: (d) => (d.package ? <span className="text-sm">{d.package.name}<span className="block text-xs text-muted">until {formatDate(d.package.endsAt)}</span></span> : <span className="text-xs text-muted">Free allowance</span>) },
            { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', render: (d) => (
              <div className="flex items-center justify-end gap-1.5">
                {!d.verified && <Button size="xs" variant="teal" onClick={() => update.mutate({ id: d.id, body: { verified: true } })}>Verify</Button>}
                <Menu trigger={(p) => <Button variant="ghost" size="icon-sm" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu" aria-label={`Actions for ${d.name}`}><MoreHorizontal className="size-4" /></Button>} items={[
                  { label: 'View storefront', icon: ExternalLink, onClick: () => window.open(`/dealer/${d.slug}`, '_blank', 'noopener') },
                  d.verified && { label: 'Remove verification', icon: ShieldCheck, onClick: () => update.mutate({ id: d.id, body: { verified: false } }) },
                  d.suspended ? { label: 'Reinstate', icon: RotateCcw, onClick: () => update.mutate({ id: d.id, body: { suspended: false } }) } : { label: 'Suspend dealer', icon: Ban, danger: true, onClick: () => update.mutate({ id: d.id, body: { suspended: true } }) },
                ]} />
              </div>
            ) },
          ]}
        />
      )}
      <p className="mt-4 text-sm text-muted">Dealer listings: <Link to="/admin/vehicles" className="text-teal-700 hover:underline">manage vehicles</Link></p>
    </>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, ImagePlus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api'
import { PageTitle } from '../../components/layout/SideNavLayout'
import { Button } from '../../components/ui/Button'
import { Avatar, Card, CardHeader, DataTable } from '../../components/ui/Data'
import { Alert, Badge, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { useTaxonomy } from '../../hooks/queries'
import { useAuth } from '../../hooks/useAuth'
import { useForm } from '../../hooks/useForm'
import { Seo } from '../../hooks/useSeo'
import { useCopyToClipboard } from '../../hooks/useUtils'
import { SITE } from '../../lib/constants'
import { formatDate, timeAgo } from '../../lib/format'
import { processImage } from '../../lib/image'
import { dealerProfileSchema, staffInviteSchema } from '../../lib/schemas'

const local = (p) => (p?.startsWith('+254') ? `0${p.slice(4)}` : p || '')

function StorefrontForm({ dealer, canEdit }) {
  const { data: tax } = useTaxonomy()
  const toast = useToast()
  const qc = useQueryClient()
  const { refresh } = useAuth()
  const [logoPreview, setLogoPreview] = useState(dealer.logoUrl)
  const [uploading, setUploading] = useState(false)
  const form = useForm(dealerProfileSchema, {
    name: dealer.name, tagline: dealer.tagline || '', description: dealer.description || '', phone: local(dealer.phone), whatsapp: local(dealer.whatsapp),
    email: dealer.email, website: dealer.website || '', county: dealer.county, town: dealer.town, address: dealer.address || '', openingHours: dealer.openingHours || '', logoUrl: dealer.logoUrl || '',
  })
  const { bind, errors, submitting, formError, handleSubmit, set } = form
  return (
    <form noValidate onSubmit={handleSubmit(async (d) => {
      await api.dealers.update(d)
      await qc.invalidateQueries({ queryKey: ['my-dealer'] })
      await refresh()
      toast.success('Storefront updated')
    })} className="space-y-6">
      {!canEdit && <Alert tone="info">Only the dealership owner can edit the storefront.</Alert>}
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card>
          <CardHeader title="Branding" />
          {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}
          <div className="flex flex-wrap items-center gap-5">
            <Avatar src={logoPreview} name={dealer.name} square size="xl" />
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                <ImagePlus className="size-4" aria-hidden="true" />{uploading ? 'Uploading…' : 'Upload logo'}
                <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  setUploading(true)
                  try {
                    const { full } = await processImage(f)
                    const up = await api.vehicles.upload({ kind: 'image', dataUrl: full.data, width: full.width, height: full.height, name: f.name })
                    set('logoUrl', up.id)
                    setLogoPreview(up.url)
                  } catch (err) {
                    toast.error('Logo upload failed', { description: err.message })
                  } finally {
                    setUploading(false)
                  }
                }} />
              </label>
              <p className="mt-1.5 text-xs text-muted">Square image, at least 400×400px.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Dealership name" error={errors.name} required>{(p) => <Input {...p} {...bind('name')} />}</Field>
            <Field label="Tagline" error={errors.tagline} optional>{(p) => <Input {...p} {...bind('tagline')} maxLength={120} />}</Field>
            <Field label="About your dealership" error={errors.description} optional className="sm:col-span-2">{(p) => <Textarea {...p} {...bind('description')} rows={5} maxLength={3000} />}</Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Contact & location" description="Shown publicly on your storefront." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone} required>{(p) => <Input {...p} {...bind('phone')} type="tel" />}</Field>
            <Field label="WhatsApp" error={errors.whatsapp} optional>{(p) => <Input {...p} {...bind('whatsapp')} type="tel" />}</Field>
            <Field label="Email" error={errors.email} required>{(p) => <Input {...p} {...bind('email')} type="email" />}</Field>
            <Field label="Website" error={errors.website} optional>{(p) => <Input {...p} {...bind('website')} type="url" placeholder="https://" />}</Field>
            <Field label="County" error={errors.county} required>{(p) => <Select {...p} {...bind('county')}>{(tax?.counties || []).map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
            <Field label="Town" error={errors.town} required>{(p) => <Input {...p} {...bind('town')} />}</Field>
            <Field label="Street address" error={errors.address} optional>{(p) => <Input {...p} {...bind('address')} />}</Field>
            <Field label="Opening hours" error={errors.openingHours} optional>{(p) => <Input {...p} {...bind('openingHours')} placeholder="Mon–Fri 8:00–18:00" />}</Field>
          </div>
        </Card>
        {canEdit && <div className="flex justify-end"><Button type="submit" loading={submitting}>Save storefront</Button></div>}
      </fieldset>
    </form>
  )
}

export function DealerStorefrontPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['my-dealer'], queryFn: api.dealers.mine })
  const [copied, copy] = useCopyToClipboard()
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (isLoading) return <Skeleton className="h-96 rounded-xl" />
  const d = data.dealer
  const url = `${SITE.url}/dealer/${d.slug}`
  return (
    <>
      <Seo title="Storefront" noindex />
      <PageTitle title="Storefront" description="Your public dealership page." action={<><Button variant="secondary" icon={Copy} onClick={() => copy(url)}>{copied ? 'Copied!' : 'Copy link'}</Button><Button variant="secondary" icon={ExternalLink} to={`/dealer/${d.slug}`}>View storefront</Button></>}>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {d.verified ? <Badge tone="teal">Verified {d.verifiedAt && `since ${formatDate(d.verifiedAt)}`}</Badge> : <Badge tone="warning">Verification pending</Badge>}
          <span className="font-mono text-xs text-muted">{url}</span>
        </div>
      </PageTitle>
      {!d.verified && <Alert tone="info" className="mb-6" title="Get verified">Email your business registration certificate and KRA PIN to {SITE.supportEmail}. Our team will verify your dealership within 2 business days. Listings from verified dealers go live instantly.</Alert>}
      <StorefrontForm dealer={d} canEdit={data.canEdit} />
    </>
  )
}

export function StaffPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['staff'], queryFn: api.dealers.staff })
  const [invite, setInvite] = useState(false)
  const [created, setCreated] = useState(null)
  const [removing, setRemoving] = useState(null)
  const form = useForm(staffInviteSchema, { name: '', email: '' })
  const remove = useMutation({
    mutationFn: (id) => api.dealers.removeStaff(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Staff member removed'); setRemoving(null) },
    onError: (e) => toast.error(e.message),
  })
  return (
    <>
      <Seo title="Staff" noindex />
      <PageTitle title="Staff" description="Team members can manage inventory and reply to leads. Only the owner can edit the storefront or add staff." action={data?.canManage && <Button icon={UserPlus} onClick={() => { setInvite(true); setCreated(null) }}>Add staff</Button>} />
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={data?.items || []}
          rowKey="userId"
          columns={[
            { key: 'name', header: 'Name', render: (r) => <span className="flex items-center gap-3"><Avatar name={r.name} size="sm" /><span><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted">{r.email}</span></span></span> },
            { key: 'role', header: 'Role', render: (r) => <Badge tone={r.role === 'OWNER' ? 'brand' : 'neutral'}>{r.role === 'OWNER' ? 'Owner' : 'Staff'}</Badge> },
            { key: 'lastLoginAt', header: 'Last active', hideOn: 'sm', render: (r) => (r.lastLoginAt ? timeAgo(r.lastLoginAt) : 'Never') },
            { key: 'actions', header: '', className: 'text-right', render: (r) => data?.canManage && r.userId !== user.id && <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setRemoving(r)}>Remove</Button> },
          ]}
        />
      )}
      <Modal open={invite} onClose={() => setInvite(false)} title={created ? 'Staff member added' : 'Add a staff member'} size="sm"
        footer={created ? <Button onClick={() => setInvite(false)}>Done</Button> : <><Button variant="secondary" onClick={() => setInvite(false)}>Cancel</Button><Button loading={form.submitting} onClick={form.handleSubmit(async (d) => {
          const res = await api.dealers.addStaff(d)
          setCreated(res)
          form.setValues({ name: '', email: '' })
          qc.invalidateQueries({ queryKey: ['staff'] })
        })}>Add staff</Button></>}>
        {created ? (
          <div className="space-y-3 text-sm">
            <Alert tone="success">{created.user.name} can now sign in with <strong>{created.user.email}</strong>.</Alert>
            <p>We emailed them a temporary password. For your records: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{created.tempPassword}</code></p>
            <p className="text-muted">Ask them to change it after signing in.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {form.formError && <Alert tone="danger">{form.formError}</Alert>}
            <Field label="Full name" error={form.errors.name} required>{(p) => <Input {...p} {...form.bind('name')} />}</Field>
            <Field label="Email" error={form.errors.email} required>{(p) => <Input {...p} {...form.bind('email')} type="email" />}</Field>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} tone="danger" title={`Remove ${removing?.name}?`} description="They will lose access to your dealership immediately." confirmLabel="Remove" loading={remove.isPending} onConfirm={() => remove.mutate(removing.userId)} />
    </>
  )
}

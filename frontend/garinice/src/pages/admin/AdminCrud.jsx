import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageTitle } from '../../components/layout/SideNavLayout'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/Data'
import { Alert, Badge, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, NumberInput, Select, Switch, Textarea } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { useForm } from '../../hooks/useForm'
import { Seo } from '../../hooks/useSeo'
import { useDebounce } from '../../hooks/useUtils'
import { formatDate, formatKES } from '../../lib/format'
import { bodyTypeSchema, brandSchema, cmsPageSchema, modelSchema, packageSchema, promotionSchema, seoRecordSchema } from '../../lib/schemas'

function VehicleLookup({ value, onChange, id }) {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 250)
  const { data } = useQuery({ queryKey: ['vehicle-lookup', dq], queryFn: () => api.admin.vehicleLookup(dq) })
  return (
    <div className="space-y-2">
      <Input id={id} size="sm" placeholder="Search published listings by title or ref" value={q} onChange={(e) => setQ(e.target.value)} />
      <Select size="sm" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Vehicle">
        <option value="">Select a vehicle…</option>
        {(data?.items || []).map((v) => <option key={v.id} value={v.id}>{v.title} · {v.ref} · {formatKES(v.price)}</option>)}
      </Select>
    </div>
  )
}

function CrudForm({ fields, schema, initial, onSubmit, onCancel, submitLabel }) {
  const form = useForm(schema, initial)
  const { values, set, errors, submitting, formError, handleSubmit } = form
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      {fields.map((f) => {
        if (f.type === 'switch') return <Switch key={f.name} label={f.label} description={f.hint} checked={!!values[f.name]} onChange={(v) => set(f.name, v)} />
        return (
          <Field key={f.name} label={f.label} error={errors[f.name]} required={f.required} hint={f.hint} optional={f.optional}>
            {(p) => {
              const common = { ...p, name: f.name, value: values[f.name] ?? '', onChange: (e) => set(f.name, e?.target ? e.target.value : e) }
              if (f.type === 'textarea') return <Textarea {...common} rows={f.rows || 4} className={f.mono ? 'font-mono text-sm' : undefined} />
              if (f.type === 'number') return <NumberInput {...common} suffix={f.suffix} />
              if (f.type === 'select') return <Select {...common} placeholder={f.placeholder}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              if (f.type === 'vehicle') return <VehicleLookup id={p.id} value={values[f.name]} onChange={(v) => set(f.name, v)} />
              return <Input {...common} type={f.type || 'text'} placeholder={f.placeholder} />
            }}
          </Field>
        )
      })}
      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>{submitLabel}</Button>
      </div>
    </form>
  )
}

/** Generic admin CRUD screen backed by /api/admin/:resource. */
export function CrudPage({ resource, title, description, singular, schema, fields, columns, defaults, toForm = (r) => r, fromForm = (v) => v, query, extra }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 250)
  const [editing, setEditing] = useState(null) // row | 'new'
  const [deleting, setDeleting] = useState(null)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', resource, dq, query], queryFn: () => api.admin.list(resource, { q: dq, ...query }) })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', resource] })
    qc.invalidateQueries({ queryKey: ['taxonomy'] })
    qc.invalidateQueries({ queryKey: ['packages'] })
    qc.invalidateQueries({ queryKey: ['home'] })
  }
  const remove = useMutation({
    mutationFn: (id) => api.admin.remove(resource, id),
    onSuccess: () => { invalidate(); toast.success(`${singular} deleted`); setDeleting(null) },
    onError: (e) => { toast.error('Couldn’t delete', { description: e.message }); setDeleting(null) },
  })
  const rows = data?.items || []
  return (
    <>
      <Seo title={title} noindex />
      <PageTitle title={title} description={description} action={<Button icon={Plus} onClick={() => setEditing('new')}>Add {singular.toLowerCase()}</Button>} />
      {extra}
      <Input size="sm" aria-label={`Search ${title}`} placeholder={`Search ${title.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          loading={isLoading}
          rows={rows}
          empty={`No ${title.toLowerCase()} yet.`}
          columns={[
            ...columns,
            { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right whitespace-nowrap', render: (r) => (
              <span className="inline-flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name || r.title || r.path}`} onClick={() => setEditing(r)}><Pencil className="size-4" /></Button>
                <Button size="icon-sm" variant="danger-ghost" aria-label={`Delete ${r.name || r.title || r.path}`} onClick={() => setDeleting(r)}><Trash2 className="size-4" /></Button>
              </span>
            ) },
          ]}
        />
      )}
      <p className="mt-3 text-xs text-muted">{rows.length} {rows.length === 1 ? singular.toLowerCase() : title.toLowerCase()}</p>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `Add ${singular.toLowerCase()}` : `Edit ${singular.toLowerCase()}`} size="lg">
        {editing && (
          <CrudForm
            fields={fields}
            schema={schema}
            initial={editing === 'new' ? (typeof defaults === 'function' ? defaults() : defaults) : toForm(editing)}
            submitLabel={editing === 'new' ? `Create ${singular.toLowerCase()}` : 'Save changes'}
            onCancel={() => setEditing(null)}
            onSubmit={async (d) => {
              if (editing === 'new') await api.admin.create(resource, fromForm(d))
              else await api.admin.update(resource, editing.id, fromForm(d))
              invalidate()
              toast.success(editing === 'new' ? `${singular} created` : `${singular} updated`)
              setEditing(null)
            }}
          />
        )}
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} tone="danger" title={`Delete ${deleting?.name || deleting?.title || deleting?.path}?`} description="This is logged in the audit trail. Items in use cannot be deleted — deactivate them instead." confirmLabel="Delete" loading={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
    </>
  )
}

const ActiveBadge = ({ on, yes = 'Active', no = 'Inactive' }) => (on ? <Badge tone="success">{yes}</Badge> : <Badge>{no}</Badge>)

export function AdminBrandsPage() {
  return (
    <CrudPage
      resource="brands" title="Brands" singular="Brand" schema={brandSchema} defaults={{ name: '', popular: false, active: true }}
      fields={[{ name: 'name', label: 'Brand name', required: true }, { name: 'popular', label: 'Popular brand', type: 'switch', hint: 'Shown in footer and homepage brand lists' }, { name: 'active', label: 'Active', type: 'switch', hint: 'Inactive brands are hidden from search and listing forms' }]}
      columns={[
        { key: 'name', header: 'Brand', render: (r) => <Link to={`/cars/${r.slug}`} className="font-medium hover:underline">{r.name}</Link> },
        { key: 'slug', header: 'Slug', hideOn: 'md', render: (r) => <code className="text-xs">{r.slug}</code> },
        { key: 'popular', header: 'Popular', render: (r) => (r.popular ? <Badge tone="accent">Popular</Badge> : '—') },
        { key: 'active', header: 'Status', render: (r) => <ActiveBadge on={r.active} /> },
      ]}
    />
  )
}

export function AdminModelsPage() {
  const { data: brands } = useQuery({ queryKey: ['admin', 'brands', ''], queryFn: () => api.admin.list('brands') })
  const { data: bodies } = useQuery({ queryKey: ['admin', 'body-types', ''], queryFn: () => api.admin.list('body-types') })
  const [brandId, setBrandId] = useState('')
  const brandName = (id) => brands?.items?.find((b) => b.id === id)?.name || '—'
  return (
    <CrudPage
      resource="models" title="Models" singular="Model" schema={modelSchema} defaults={{ brandId: brandId || '', name: '', bodyTypeId: '', active: true }}
      query={{ brandId: brandId || undefined }}
      extra={<Select size="sm" aria-label="Filter by brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="mb-3 max-w-xs"><option value="">All brands</option>{(brands?.items || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>}
      fields={[
        { name: 'brandId', label: 'Brand', type: 'select', required: true, placeholder: 'Select brand', options: (brands?.items || []).map((b) => ({ value: b.id, label: b.name })) },
        { name: 'name', label: 'Model name', required: true },
        { name: 'bodyTypeId', label: 'Default body type', type: 'select', optional: true, placeholder: 'None', options: (bodies?.items || []).map((b) => ({ value: b.id, label: b.name })) },
        { name: 'active', label: 'Active', type: 'switch' },
      ]}
      columns={[
        { key: 'name', header: 'Model', render: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'brandId', header: 'Brand', render: (r) => brandName(r.brandId) },
        { key: 'bodyTypeId', header: 'Body type', hideOn: 'md', render: (r) => bodies?.items?.find((b) => b.id === r.bodyTypeId)?.name || '—' },
        { key: 'active', header: 'Status', render: (r) => <ActiveBadge on={r.active} /> },
      ]}
    />
  )
}

export function AdminCategoriesPage() {
  return (
    <CrudPage
      resource="body-types" title="Categories" singular="Body type" description="Body types power filters, landing pages and SEO content." schema={bodyTypeSchema} defaults={{ name: '', description: '' }}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'description', label: 'Landing page introduction', type: 'textarea', optional: true, hint: 'Shown on /cars/body/… pages. Make it genuinely useful for buyers.' }]}
      columns={[
        { key: 'name', header: 'Body type', render: (r) => <Link to={`/cars/body/${r.slug}`} className="font-medium hover:underline">{r.name}</Link> },
        { key: 'slug', header: 'URL', hideOn: 'md', render: (r) => <code className="text-xs">/cars/body/{r.slug}</code> },
        { key: 'description', header: 'Intro', hideOn: 'lg', render: (r) => <span className="line-clamp-2 max-w-md text-xs text-muted">{r.description || '—'}</span> },
      ]}
    />
  )
}

export function AdminPackagesPage() {
  return (
    <CrudPage
      resource="packages" title="Packages" singular="Package" description="Listing and dealer packages. Prices are enforced server-side at checkout." schema={packageSchema}
      defaults={{ name: '', description: '', price: '', durationDays: '30', listingLimit: '1', featured: false, boostDays: '0', analytics: false, audience: 'ALL', active: true }}
      toForm={(r) => ({ ...r, price: String(r.price), durationDays: String(r.durationDays), listingLimit: String(r.listingLimit), boostDays: String(r.boostDays) })}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea', rows: 2, optional: true },
        { name: 'audience', label: 'Available to', type: 'select', options: [{ value: 'ALL', label: 'All sellers (per listing)' }, { value: 'PRIVATE', label: 'Private sellers' }, { value: 'DEALER', label: 'Dealers (subscription)' }] },
        { name: 'price', label: 'Price', type: 'number', suffix: 'KES', required: true },
        { name: 'durationDays', label: 'Duration', type: 'number', suffix: 'days', required: true },
        { name: 'listingLimit', label: 'Number of listings', type: 'number', required: true },
        { name: 'boostDays', label: 'Search boost', type: 'number', suffix: 'days' },
        { name: 'featured', label: 'Featured placement', type: 'switch', hint: 'Homepage and top-of-search feature' },
        { name: 'analytics', label: 'Analytics access', type: 'switch' },
        { name: 'active', label: 'Active', type: 'switch', hint: 'Inactive packages cannot be purchased' },
      ]}
      columns={[
        { key: 'name', header: 'Package', render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-xs text-muted">{r.audience === 'DEALER' ? 'Dealer subscription' : 'Per listing'}</span></span> },
        { key: 'price', header: 'Price', render: (r) => (r.price ? formatKES(r.price) : 'Free') },
        { key: 'durationDays', header: 'Duration', hideOn: 'md', render: (r) => `${r.durationDays} days` },
        { key: 'listingLimit', header: 'Listings', hideOn: 'md', className: 'tabular-nums' },
        { key: 'perks', header: 'Perks', hideOn: 'lg', render: (r) => <span className="flex flex-wrap gap-1">{r.featured && <Badge tone="accent">Featured</Badge>}{r.boostDays > 0 && <Badge tone="info">{r.boostDays}d boost</Badge>}{r.analytics && <Badge tone="teal">Analytics</Badge>}</span> },
        { key: 'active', header: 'Status', render: (r) => <ActiveBadge on={r.active} /> },
      ]}
    />
  )
}

const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

export function AdminPromotionsPage() {
  return (
    <CrudPage
      resource="promotions" title="Promotions" singular="Promotion" description="Manual promotional placements on the homepage and search." schema={promotionSchema}
      defaults={() => ({ title: '', placement: 'HOMEPAGE_FEATURED', vehicleId: '', startsAt: toLocalInput(new Date().toISOString()), endsAt: toLocalInput(new Date(Date.now() + 14 * 86400000).toISOString()), active: true })}
      toForm={(r) => ({ ...r, startsAt: toLocalInput(r.startsAt), endsAt: toLocalInput(r.endsAt) })}
      fromForm={(v) => ({ ...v, startsAt: new Date(v.startsAt).toISOString(), endsAt: new Date(v.endsAt).toISOString() })}
      fields={[
        { name: 'title', label: 'Internal title', required: true },
        { name: 'placement', label: 'Placement', type: 'select', options: [{ value: 'HOMEPAGE_FEATURED', label: 'Homepage featured cars' }, { value: 'SEARCH_TOP', label: 'Top of search results' }, { value: 'HOMEPAGE_BANNER', label: 'Homepage banner' }] },
        { name: 'vehicleId', label: 'Vehicle', type: 'vehicle', required: true },
        { name: 'startsAt', label: 'Starts', type: 'datetime-local', required: true },
        { name: 'endsAt', label: 'Ends', type: 'datetime-local', required: true },
        { name: 'active', label: 'Active', type: 'switch' },
      ]}
      columns={[
        { key: 'title', header: 'Promotion', render: (r) => <span className="font-medium">{r.title}</span> },
        { key: 'placement', header: 'Placement', render: (r) => <Badge tone="brand">{r.placement.replace(/_/g, ' ').toLowerCase()}</Badge> },
        { key: 'dates', header: 'Runs', hideOn: 'md', render: (r) => <span className="text-xs">{formatDate(r.startsAt)} – {formatDate(r.endsAt)}</span> },
        { key: 'active', header: 'Status', render: (r) => <ActiveBadge on={r.active && new Date(r.endsAt) > new Date()} yes="Running" no="Ended" /> },
      ]}
    />
  )
}

export function AdminCmsPage() {
  return (
    <CrudPage
      resource="pages" title="CMS pages" singular="Page" description="Content for About, FAQ, Safety, Terms, Privacy and Help. Supports ## headings, ### questions, - lists, **bold** and [links](/path)." schema={cmsPageSchema}
      defaults={{ slug: '', title: '', body: '', published: true }}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'slug', label: 'Slug', required: true, hint: 'URL path, e.g. “about” → /about' },
        { name: 'body', label: 'Content', type: 'textarea', rows: 16, mono: true },
        { name: 'published', label: 'Published', type: 'switch' },
      ]}
      columns={[
        { key: 'title', header: 'Page', render: (r) => <span className="font-medium">{r.title}</span> },
        { key: 'slug', header: 'URL', render: (r) => <Link to={`/${r.slug}`} className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline">/{r.slug}<ExternalLink className="size-3" /></Link> },
        { key: 'updatedAt', header: 'Updated', hideOn: 'md', render: (r) => formatDate(r.updatedAt) },
        { key: 'published', header: 'Status', render: (r) => <ActiveBadge on={r.published} yes="Published" no="Draft" /> },
      ]}
    />
  )
}

export function AdminSeoPage() {
  return (
    <CrudPage
      resource="seo" title="SEO" singular="SEO record" description="Override titles, descriptions and intro copy for any page. Vehicle pages generate metadata, Open Graph, Twitter cards and Car schema automatically." schema={seoRecordSchema}
      defaults={{ path: '/cars/', title: '', description: '', intro: '', noindex: false }}
      extra={<Alert tone="info" className="mb-4" title="Sitemaps">Dynamic sitemaps for vehicles, dealers, brands and body types are generated from live data (see <Link to="/sitemap" className="underline">HTML sitemap</Link>; XML is served at /sitemap.xml in production).</Alert>}
      fields={[
        { name: 'path', label: 'Page path', required: true, hint: 'e.g. /cars/toyota or /cars/body/suv' },
        { name: 'title', label: 'Meta title', required: true, hint: '5–70 characters' },
        { name: 'description', label: 'Meta description', type: 'textarea', rows: 3, required: true, hint: '20–170 characters' },
        { name: 'intro', label: 'On-page introduction', type: 'textarea', rows: 4, optional: true, hint: 'Shown at the top of landing pages' },
        { name: 'noindex', label: 'Hide from search engines (noindex)', type: 'switch' },
      ]}
      columns={[
        { key: 'path', header: 'Path', render: (r) => <Link to={r.path} className="font-mono text-xs text-teal-700 hover:underline">{r.path}</Link> },
        { key: 'title', header: 'Title', render: (r) => <span className="line-clamp-1 max-w-xs">{r.title}</span> },
        { key: 'description', header: 'Description', hideOn: 'lg', render: (r) => <span className="line-clamp-2 max-w-sm text-xs text-muted">{r.description}</span> },
        { key: 'noindex', header: 'Index', render: (r) => (r.noindex ? <Badge tone="warning">noindex</Badge> : <Badge tone="success">index</Badge>) },
      ]}
    />
  )
}

import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, Mail, MessageSquare, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { WhatsAppIcon } from '../components/ui/BrandIcons'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Data'
import { Alert, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Form'
import { Markdown } from '../components/ui/Markdown'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useAuth } from '../hooks/useAuth'
import { useForm } from '../hooks/useForm'
import { Seo } from '../hooks/useSeo'
import { SITE } from '../lib/constants'
import { contactFormSchema } from '../lib/schemas'
import { formatDate } from '../lib/format'
import NotFoundPage from './NotFoundPage'

/** CMS-driven content page. FAQ pages (### headings) render as an accessible accordion with FAQPage schema. */
export function CmsPage({ slug }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['page', slug], queryFn: () => api.catalog.page(slug), retry: false })
  if (error?.status === 404) return <NotFoundPage />
  const page = data?.page
  const isFaq = slug === 'faq'
  const faqs = isFaq && page ? page.body.split(/\n(?=### )/).filter((b) => b.startsWith('### ')).map((b) => {
    const [q, ...rest] = b.split('\n')
    return { q: q.slice(4), a: rest.join('\n').trim() }
  }) : []
  return (
    <div className="bg-white">
      <Seo
        title={page?.title}
        description={page?.body?.replace(/[#*[\]()]/g, '').slice(0, 155)}
        jsonLd={isFaq && faqs.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/\*\*/g, '') } })) } : undefined}
      />
      <div className="container-page max-w-3xl py-10 sm:py-14">
        <Breadcrumbs items={[{ label: page?.title || '…' }]} />
        {isLoading ? (
          <div className="mt-6 space-y-4"><Skeleton className="h-10 w-2/3" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} className="mt-8" />
        ) : (
          <>
            <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">{page.title}</h1>
            <p className="mt-2 text-sm text-muted">Last updated {formatDate(page.updatedAt)}</p>
            <div className="mt-8">
              {isFaq ? (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {faqs.map((f) => (
                    <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                        {f.q}
                        <ChevronDown className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <Markdown source={f.a} className="prose-gn mt-3" />
                    </details>
                  ))}
                </div>
              ) : (
                <Markdown source={page.body} />
              )}
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6 text-center">
              <p className="font-semibold">Still have questions?</p>
              <p className="mt-1 text-sm text-muted">Our team is happy to help.</p>
              <Button to="/contact" variant="secondary" className="mt-4">Contact us</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ContactPage() {
  const { user } = useAuth()
  const form = useForm(contactFormSchema, { name: user?.name || '', email: user?.email || '', subject: '', message: '' })
  const { bind, errors, submitting, formError, handleSubmit } = form
  const mutation = useMutation({ mutationFn: api.catalog.contact })
  return (
    <div className="container-page py-10 sm:py-14">
      <Seo title="Contact us" description={`Get in touch with the ${SITE.name} team for help with buying, selling or your account.`} />
      <Breadcrumbs items={[{ label: 'Contact' }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Contact us</h1>
          <p className="mt-2 max-w-xl text-muted">Questions about a listing, your account or payments? Send us a message and we’ll respond within one business day.</p>
          <Card className="mt-8">
            {mutation.isSuccess ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-bold">Message received</h2>
                <p className="mt-2 text-muted">Thanks for reaching out. We’ll reply to {form.values.email}.</p>
                <Button variant="secondary" className="mt-6" to="/cars">Continue browsing</Button>
              </div>
            ) : (
              <form noValidate onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="grid gap-5 sm:grid-cols-2">
                {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
                <Field label="Your name" error={errors.name} required>{(p) => <Input {...p} {...bind('name')} autoComplete="name" />}</Field>
                <Field label="Email" error={errors.email} required>{(p) => <Input {...p} {...bind('email')} type="email" autoComplete="email" />}</Field>
                <Field label="Subject" error={errors.subject} required className="sm:col-span-2">{(p) => <Input {...p} {...bind('subject')} />}</Field>
                <Field label="Message" error={errors.message} required className="sm:col-span-2">{(p) => <Textarea {...p} {...bind('message')} rows={6} />}</Field>
                <div className="sm:col-span-2"><Button type="submit" size="lg" loading={submitting}>Send message</Button></div>
              </form>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <h2 className="font-semibold">Other ways to reach us</h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3"><Mail className="size-5 text-teal-700" aria-hidden="true" /><span><span className="block text-muted">Email</span><a href={`mailto:${SITE.supportEmail}`} className="font-medium hover:underline">{SITE.supportEmail}</a></span></li>
              <li className="flex gap-3"><Phone className="size-5 text-teal-700" aria-hidden="true" /><span><span className="block text-muted">Phone (Mon–Fri, 8am–6pm)</span><a href={`tel:${SITE.supportPhone.replace(/\s/g, '')}`} className="font-medium hover:underline">{SITE.supportPhone}</a></span></li>
              <li className="flex gap-3"><WhatsAppIcon className="size-5 text-teal-700" /><span><span className="block text-muted">WhatsApp</span><a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">Chat with support</a></span></li>
            </ul>
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="size-5 text-teal-700" aria-hidden="true" />Quick answers</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {[['/faq', 'Frequently asked questions'], ['/safety', 'Buying and selling safely'], ['/how-it-works', 'How GariNice works']].map(([to, l]) => <li key={to}><Link to={to} className="text-teal-700 hover:underline">{l}</Link></li>)}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function SitemapPage() {
  const { data, isLoading } = useQuery({ queryKey: ['sitemap'], queryFn: api.catalog.sitemap })
  const static_ = [['/', 'Home'], ['/cars', 'Browse cars'], ['/sell', 'Sell your car'], ['/dealers', 'Dealers'], ['/how-it-works', 'How it works'], ['/about', 'About'], ['/faq', 'FAQ'], ['/safety', 'Safety'], ['/contact', 'Contact'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/cars/price/under-1m', 'Cars under 1M'], ['/cars/price/under-2m', 'Cars under 2M'], ['/cars/price/2m-5m', 'Cars 2M–5M'], ['/cars/price/above-5m', 'Cars above 5M']]
  const label = (p) => p.split('/').pop().replace(/-[a-z0-9]{8}$/, '').replace(/-/g, ' ')
  return (
    <div className="container-page py-10">
      <Seo title="Sitemap" />
      <h1 className="text-3xl font-extrabold">Sitemap</h1>
      {isLoading ? <Skeleton className="mt-6 h-64" /> : (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[['Pages', static_], ['Brands', data.brands.map((b) => [b.path, label(b.path)])], ['Body types', data.bodyTypes.map((b) => [b.path, label(b.path)])], ['Dealers', data.dealers.map((d) => [d.path, label(d.path)])]].map(([title, links]) => (
            <section key={title}>
              <h2 className="font-semibold">{title}</h2>
              <ul className="mt-3 space-y-1.5 text-sm capitalize">{links.map(([to, l]) => <li key={to}><Link to={to} className="text-teal-700 hover:underline">{l}</Link></li>)}</ul>
            </section>
          ))}
          <section className="sm:col-span-2 lg:col-span-4">
            <h2 className="font-semibold">Vehicles ({data.vehicles.length})</h2>
            <ul className="mt-3 columns-1 gap-6 text-sm capitalize sm:columns-2 lg:columns-4">{data.vehicles.map((v) => <li key={v.path} className="mb-1.5 break-inside-avoid"><Link to={v.path} className="text-teal-700 hover:underline">{label(v.path)}</Link></li>)}</ul>
          </section>
        </div>
      )}
    </div>
  )
}

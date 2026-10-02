import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, KeyRound, ShieldAlert, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Data'
import { Alert, Badge, EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Switch, Textarea } from '../../components/ui/Form'
import { Pagination } from '../../components/ui/Navigation'
import { Modal } from '../../components/ui/Overlay'
import { useToast } from '../../components/ui/Toast'
import { VehicleCard, VehicleCardSkeleton } from '../../components/vehicle/VehicleCard'
import { PasswordInput } from '../../features/auth/LoginForm'
import { Inbox } from '../../features/messages/Inbox'
import { useAuth } from '../../hooks/useAuth'
import { useForm } from '../../hooks/useForm'
import { Seo } from '../../hooks/useSeo'
import { ROLE_LABELS } from '../../lib/constants'
import { formatDate, timeAgo } from '../../lib/format'
import { changePasswordSchema, profileSchema } from '../../lib/schemas'

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SavedPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['favourites', 'list', page], queryFn: () => api.favourites.list({ page }), placeholderData: keepPreviousData })
  return (
    <div className="container-page py-8 sm:py-10">
      <Seo title="Saved cars" noindex />
      <PageHeader title="Saved cars" subtitle={data ? `${data.total} saved ${data.total === 1 ? 'car' : 'cars'}` : 'Cars you’ve saved'} action={<Button variant="secondary" to="/cars">Browse more cars</Button>} />
      {error ? <ErrorState error={error} onRetry={refetch} /> : isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <VehicleCardSkeleton key={i} />)}</div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={Heart} title="No saved vehicles yet" description="Tap the heart on any car to save it here. You’ll get notified if a saved car is sold." action={<Button to="/cars">Start browsing</Button>} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((v) => (
              <VehicleCard key={v.id} vehicle={v} footer={<p className="mt-2 text-xs text-muted">Saved {timeAgo(v.savedAt)}{!v.available && v.status !== 'SOLD' && <Badge tone="neutral" className="ml-2">No longer listed</Badge>}</p>} />
            ))}
          </div>
          <Pagination className="mt-8" page={data.page} pageCount={data.pageCount} onChange={(p) => setParams({ page: p })} />
        </>
      )}
    </div>
  )
}

export function MessagesPage() {
  return (
    <div className="container-page py-6 sm:py-8">
      <Seo title="Messages" noindex />
      <h1 className="mb-5 text-2xl font-bold">Messages</h1>
      <Inbox mode="buyer" />
    </div>
  )
}

export function ProfileForm() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const form = useForm(profileSchema, {
    name: user.name, phone: user.phone || '', location: user.profile.location, bio: user.profile.bio,
    notifyEmail: user.profile.notifyEmail, notifySms: user.profile.notifySms, notifyWhatsapp: user.profile.notifyWhatsapp,
  })
  const { values, set, bind, errors, submitting, formError, handleSubmit } = form
  return (
    <form noValidate onSubmit={handleSubmit(async (d) => { await api.account.update(d); await refresh(); toast.success('Profile updated') })} className="space-y-6">
      <Card>
        <CardHeader title="Personal details" description="Your name is shown to sellers and buyers you message." />
        {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" error={errors.name} required>{(p) => <Input {...p} {...bind('name')} autoComplete="name" />}</Field>
          <Field label="Email" hint="Contact support to change your email.">{(p) => <Input {...p} value={user.email} disabled />}</Field>
          <Field label="Phone" error={errors.phone} optional>{(p) => <Input {...p} {...bind('phone')} type="tel" autoComplete="tel" />}</Field>
          <Field label="Location" optional>{(p) => <Input {...p} {...bind('location')} placeholder="e.g. Nairobi" />}</Field>
          <Field label="About you" optional className="sm:col-span-2">{(p) => <Textarea {...p} {...bind('bio')} rows={3} maxLength={500} />}</Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Notifications" description="Choose how we tell you about messages, listing updates and payments. In-app notifications are always on." />
        <div className="space-y-4">
          <Switch label="Email" description={user.email} checked={values.notifyEmail} onChange={(v) => set('notifyEmail', v)} />
          <Switch label="SMS" description={user.phone || 'Add a phone number to enable'} disabled={!user.phone} checked={values.notifySms} onChange={(v) => set('notifySms', v)} />
          <Switch label="WhatsApp" description="Get enquiry alerts on WhatsApp" disabled={!user.phone} checked={values.notifyWhatsapp} onChange={(v) => set('notifyWhatsapp', v)} />
        </div>
      </Card>
      <div className="flex justify-end"><Button type="submit" loading={submitting}>Save changes</Button></div>
    </form>
  )
}

export function SecuritySection() {
  const toast = useToast()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const form = useForm(changePasswordSchema, { currentPassword: '', password: '', confirmPassword: '' })
  const { bind, errors, submitting, formError, handleSubmit, setValues } = form
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [password, setPassword] = useState('')
  const del = useMutation({
    mutationFn: () => api.account.remove(password),
    onSuccess: async () => {
      await logout()
      qc.clear()
      toast.success('Your account has been deleted')
      navigate('/')
    },
  })
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Change password" description="Other devices will be signed out." />
        <form noValidate onSubmit={handleSubmit(async (d) => { await api.account.changePassword(d); setValues({ currentPassword: '', password: '', confirmPassword: '' }); toast.success('Password changed') })} className="grid max-w-xl gap-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Current password" error={errors.currentPassword} required>{(p) => <PasswordInput {...p} {...bind('currentPassword')} autoComplete="current-password" />}</Field>
          <Field label="New password" error={errors.password} required hint="8+ characters with a letter and a number">{(p) => <PasswordInput {...p} {...bind('password')} autoComplete="new-password" />}</Field>
          <Field label="Confirm new password" error={errors.confirmPassword} required>{(p) => <PasswordInput {...p} {...bind('confirmPassword')} autoComplete="new-password" />}</Field>
          <div><Button type="submit" icon={KeyRound} loading={submitting}>Update password</Button></div>
        </form>
      </Card>
      <Card className="border-red-200">
        <CardHeader title="Delete account" description="Permanently delete your account. Your listings will be archived and your saved cars removed. This cannot be undone." />
        <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete my account</Button>
      </Card>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?" size="sm" footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={del.isPending} onClick={() => del.mutate()} disabled={!password}>Delete permanently</Button></>}>
        <div className="space-y-4">
          <Alert tone="danger" title="This cannot be undone">All your listings will be removed from the marketplace.</Alert>
          {del.error && <Alert tone="danger">{del.error.fieldErrors?.password || del.error.message}</Alert>}
          <Field label="Enter your password to confirm" required>{(p) => <PasswordInput {...p} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}</Field>
        </div>
      </Modal>
    </div>
  )
}

export function AccountPage() {
  const { user } = useAuth()
  return (
    <div className="container-page max-w-4xl py-8 sm:py-10">
      <Seo title="My account" noindex />
      <PageHeader title="My account" subtitle={<span className="inline-flex flex-wrap items-center gap-2">{ROLE_LABELS[user.role]} · Member since {formatDate(user.createdAt, { month: 'long', year: 'numeric' })}{user.verified && <Badge tone="teal">Verified</Badge>}</span>} action={<Button variant="secondary" icon={UserRound} to="/dashboard">Go to dashboard</Button>} />
      {!user.emailVerified && <Alert tone="warning" className="mb-6" title="Verify your email">We sent a verification link to {user.email}. Verified emails help keep your account secure.</Alert>}
      <div className="space-y-8">
        <ProfileForm />
        <section aria-labelledby="sec-h">
          <h2 id="sec-h" className="mb-4 flex items-center gap-2 text-lg font-bold"><ShieldAlert className="size-5 text-slate-500" aria-hidden="true" />Security</h2>
          <SecuritySection />
        </section>
      </div>
    </div>
  )
}

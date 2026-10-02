import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, MailCheck, ShieldCheck, Store, User, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { usingMockApi } from '../../api/client'
import { Logo } from '../../components/layout/Logo'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Checkbox, Field, Input, RadioCards } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { LoginForm, PasswordInput } from '../../features/auth/LoginForm'
import { useAuth } from '../../hooks/useAuth'
import { useForm } from '../../hooks/useForm'
import { Seo } from '../../hooks/useSeo'
import { forgotPasswordSchema, registerSchema, resetPasswordSchema } from '../../lib/schemas'

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next, fallback = '/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col">
        <Logo inverted />
        <div className="mt-auto max-w-md">
          <p className="font-display text-3xl leading-tight font-bold">Buy and sell cars across Kenya with confidence.</p>
          <ul className="mt-8 space-y-4 text-brand-100">
            {['Thousands of listings from dealers and private sellers', 'Seller contact details shared only when sellers choose', 'Every listing reviewed by our moderation team'].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>
        <svg className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] text-white/5" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" strokeWidth="18" /><circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="14" /></svg>
      </aside>
      <main id="main" className="flex flex-col bg-white px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export function LoginPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'), null)
  if (user) return <Navigate to={next || '/dashboard'} replace />
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your saved cars, messages and listings." footer={<>Don’t have an account? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-teal-700 hover:underline">Create one</Link></>}>
      <Seo title="Sign in" noindex />
      <LoginForm onSuccess={(u) => navigate(next || (['ADMIN', 'SUPER_ADMIN'].includes(u.role) ? '/admin' : '/dashboard'), { replace: true })} />
    </AuthShell>
  )
}

export function RegisterPage() {
  const [params] = useSearchParams()
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'), null)
  const preset = params.get('type')
  const form = useForm(registerSchema, {
    name: '', email: '', phone: '', password: '', confirmPassword: '', dealerName: '', acceptTerms: false,
    accountType: preset === 'dealer' ? 'DEALER' : preset === 'seller' ? 'PRIVATE_SELLER' : 'BUYER',
  })
  const { values, set, bind, errors, submitting, formError, handleSubmit } = form
  if (user && !submitting) return <Navigate to={next || '/dashboard'} replace />

  return (
    <AuthShell title="Create your account" subtitle="It’s free and takes less than a minute." footer={<>Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-teal-700 hover:underline">Sign in</Link></>}>
      <Seo title="Create an account" noindex />
      <form noValidate className="space-y-5" onSubmit={handleSubmit(async (data) => {
        const u = await register(data)
        navigate(next || (u.role === 'BUYER' ? '/cars' : u.role === 'DEALER' ? '/dashboard/dealer' : '/sell/vehicle'), { replace: true })
      })}>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">I want to</legend>
          <RadioCards
            name="accountType"
            value={values.accountType}
            onChange={(v) => set('accountType', v)}
            columns={3}
            options={[
              { value: 'BUYER', label: 'Buy a car', icon: UserRound },
              { value: 'PRIVATE_SELLER', label: 'Sell my car', icon: User },
              { value: 'DEALER', label: 'List as dealer', icon: Store },
            ]}
          />
        </fieldset>
        {values.accountType === 'DEALER' && (
          <Field label="Dealership name" error={errors.dealerName} required hint="Your storefront will be created automatically. Verification is done by our team.">
            {(p) => <Input {...p} {...bind('dealerName')} autoComplete="organization" />}
          </Field>
        )}
        <Field label="Full name" error={errors.name} required>{(p) => <Input {...p} {...bind('name')} autoComplete="name" />}</Field>
        <Field label="Email address" error={errors.email} required>{(p) => <Input {...p} {...bind('email')} type="email" autoComplete="email" />}</Field>
        <Field label="Phone number" error={errors.phone} optional hint="Used for M-Pesa payments and account security. Never shown publicly without your consent.">
          {(p) => <Input {...p} {...bind('phone')} type="tel" autoComplete="tel" placeholder="0712 345 678" />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password" error={errors.password} required hint="8+ characters with a letter and a number">{(p) => <PasswordInput {...p} {...bind('password')} autoComplete="new-password" />}</Field>
          <Field label="Confirm password" error={errors.confirmPassword} required>{(p) => <PasswordInput {...p} {...bind('confirmPassword')} autoComplete="new-password" />}</Field>
        </div>
        <div>
          <Checkbox {...bind('acceptTerms', { type: 'checkbox' })} label={<>I agree to the <Link to="/terms" className="font-medium text-teal-700 underline" target="_blank">Terms</Link> and <Link to="/privacy" className="font-medium text-teal-700 underline" target="_blank">Privacy policy</Link></>} />
          {errors.acceptTerms && <p className="mt-1 text-xs font-medium text-danger">{errors.acceptTerms}</p>}
        </div>
        <Button type="submit" size="lg" block loading={submitting}>Create account</Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" aria-hidden="true" /> Your data is protected under the Kenya Data Protection Act.</p>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const form = useForm(forgotPasswordSchema, { email: '' })
  const { bind, errors, submitting, formError, handleSubmit } = form
  const [result, setResult] = useState(null)
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we’ll send you a link to reset your password." footer={<Link to="/login" className="font-semibold text-teal-700 hover:underline">Back to sign in</Link>}>
      <Seo title="Forgot password" noindex />
      {result ? (
        <div className="space-y-4">
          <Alert tone="success" title="Check your inbox">{result.message}</Alert>
          {usingMockApi && result.demoLink && (
            <Alert tone="info" title="Demo mode">
              Emails aren’t sent in demo mode. <Link to={result.demoLink} className="font-semibold underline">Open the reset link</Link>.
            </Alert>
          )}
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit(async (d) => setResult(await api.auth.forgotPassword(d)))} className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Email address" error={errors.email} required>{(p) => <Input {...p} {...bind('email')} type="email" autoComplete="email" />}</Field>
          <Button type="submit" size="lg" block loading={submitting} icon={MailCheck}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const token = params.get('token') || ''
  const form = useForm(resetPasswordSchema, { token, password: '', confirmPassword: '' })
  const { bind, errors, submitting, formError, handleSubmit } = form
  const mutation = useMutation({ mutationFn: api.auth.resetPassword })
  return (
    <AuthShell title="Choose a new password" footer={<Link to="/forgot-password" className="font-semibold text-teal-700 hover:underline">Request a new link</Link>}>
      <Seo title="Reset password" noindex />
      {!token ? (
        <Alert tone="danger" title="Invalid link">This reset link is missing its token. Request a new one.</Alert>
      ) : (
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (d) => {
          await mutation.mutateAsync(d)
          toast.success('Password updated', { description: 'Sign in with your new password.' })
          navigate('/login', { replace: true })
        })}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="New password" error={errors.password} required hint="8+ characters with a letter and a number">{(p) => <PasswordInput {...p} {...bind('password')} autoComplete="new-password" />}</Field>
          <Field label="Confirm new password" error={errors.confirmPassword} required>{(p) => <PasswordInput {...p} {...bind('confirmPassword')} autoComplete="new-password" />}</Field>
          <Button type="submit" size="lg" block loading={submitting}>Update password</Button>
        </form>
      )}
    </AuthShell>
  )
}

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usingMockApi } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Field, Input } from '../../components/ui/Form'
import { useAuth } from '../../hooks/useAuth'
import { useForm } from '../../hooks/useForm'
import { loginSchema } from '../../lib/schemas'

const DEMO_ACCOUNTS = [
  ['Buyer', 'buyer@example.com'],
  ['Private seller', 'wanjiku@example.com'],
  ['Dealer', 'owner@axismotors.co.ke'],
  ['Admin', 'admin@garinice.co.ke'],
]

export function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-12" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  )
}

export function LoginForm({ onSuccess, compact }) {
  const { login } = useAuth()
  const form = useForm(loginSchema, { email: '', password: '' })
  const { bind, errors, submitting, formError, handleSubmit, setValues } = form

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        // Note: `onSuccess?.(await login(data))` would skip login() entirely when onSuccess is undefined.
        const signedIn = await login(data)
        onSuccess?.(signedIn)
      })}
      noValidate
      className="space-y-4"
    >
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Field label="Email address" error={errors.email} required>
        {(p) => <Input {...p} {...bind('email')} type="email" autoComplete="email" inputMode="email" data-autofocus />}
      </Field>
      <Field label="Password" error={errors.password} required>
        {(p) => <PasswordInput {...p} {...bind('password')} autoComplete="current-password" />}
      </Field>
      <div className="flex justify-end">
        <Link to="/forgot-password" className="text-sm font-medium text-teal-700 hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" block size="lg" loading={submitting}>Sign in</Button>
      {usingMockApi && (
        <div className={compact ? 'pt-1' : 'rounded-lg border border-dashed border-slate-300 p-3'}>
          <p className="text-xs font-medium text-muted">Demo accounts (password: Password123!)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map(([label, email]) => (
              <button key={email} type="button" onClick={() => setValues({ email, password: 'Password123!' })} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}

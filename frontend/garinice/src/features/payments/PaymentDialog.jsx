import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Field, Input, RadioCards } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Overlay'
import { useAuth } from '../../hooks/useAuth'
import { usingMockApi } from '../../api/client'
import { PAYMENT_METHODS } from '../../lib/constants'
import { cn, formatKES } from '../../lib/format'

const FINAL = ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']
const newKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

/**
 * M-Pesa STK push checkout. The amount is set server-side from the package; this UI
 * only polls the payment status — success is confirmed by the gateway webhook.
 */
export function PaymentDialog({ open, onClose, packages = [], vehicle, defaultPackageId, onPaid }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [packageId, setPackageId] = useState(defaultPackageId || packages[0]?.id)
  const [phone, setPhone] = useState(user?.phone ? `0${user.phone.slice(4)}` : '')
  const [method, setMethod] = useState('MPESA')
  const [idempotencyKey, setKey] = useState(newKey)
  const [paymentId, setPaymentId] = useState(null)
  const pkg = packages.find((p) => p.id === packageId)

  const create = useMutation({
    mutationFn: () => api.payments.create({ packageId, vehicleId: vehicle?.id, method, phone, idempotencyKey }),
    onSuccess: (res) => setPaymentId(res.payment.id),
  })
  const status = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api.payments.get(paymentId),
    enabled: !!paymentId,
    refetchInterval: (q) => (FINAL.includes(q.state.data?.payment?.status) ? false : 2000),
  })
  const payment = status.data?.payment
  const done = payment && FINAL.includes(payment.status)
  const handled = useRef(null)
  useEffect(() => {
    if (payment?.status !== 'SUCCESS' || handled.current === payment.id) return
    handled.current = payment.id
    qc.invalidateQueries({ queryKey: ['payments'] })
    qc.invalidateQueries({ queryKey: ['my-vehicles'] })
    qc.invalidateQueries({ queryKey: ['quota'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
    onPaid?.(payment)
  }, [payment, qc, onPaid])
  const reset = () => {
    setPaymentId(null)
    setKey(newKey())
    create.reset()
  }
  const close = () => {
    onClose()
    setTimeout(reset, 200)
  }

  return (
    <Modal open={open} onClose={close} title={done ? (payment.status === 'SUCCESS' ? 'Payment successful' : 'Payment not completed') : 'Complete payment'} description={vehicle ? `For: ${vehicle.title}` : undefined} size="md"
      footer={
        done ? (
          payment.status === 'SUCCESS' ? <Button onClick={close}>Done</Button> : <><Button variant="secondary" onClick={close}>Close</Button><Button onClick={reset}>Try again</Button></>
        ) : paymentId ? null : (
          <><Button variant="secondary" onClick={close}>Cancel</Button><Button variant="accent" icon={Smartphone} loading={create.isPending} disabled={!pkg} onClick={() => create.mutate()}>Pay {pkg ? formatKES(pkg.price) : ''}</Button></>
        )
      }
    >
      {done ? (
        <div className="py-4 text-center">
          {payment.status === 'SUCCESS' ? <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden="true" /> : <XCircle className="mx-auto size-14 text-danger" aria-hidden="true" />}
          <p className="mt-4 text-lg font-semibold">{formatKES(payment.amount)} · {payment.package?.name}</p>
          {payment.status === 'SUCCESS' ? (
            <p className="mt-2 text-sm text-muted">M-Pesa receipt <strong className="text-ink">{payment.receipt}</strong>. Your package is now active.</p>
          ) : (
            <p className="mt-2 text-sm text-muted">{payment.failureReason || 'The payment was not completed.'} No money was taken.</p>
          )}
          <p className="mt-1 text-xs text-muted">Reference {payment.reference}</p>
        </div>
      ) : paymentId ? (
        <div className="py-6 text-center" role="status" aria-live="polite">
          <Loader2 className="mx-auto size-12 animate-spin text-teal-600" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold">Check your phone</p>
          <p className="mt-1 text-sm text-muted">We sent an M-Pesa prompt to <strong>{phone}</strong>. Enter your M-Pesa PIN to pay {formatKES(pkg?.price)}.</p>
          <p className="mt-4 text-xs text-muted">Waiting for confirmation from M-Pesa… Don’t close this window.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {create.error && <Alert tone="danger">{create.error.fieldErrors?.phone || create.error.message}</Alert>}
          {packages.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Package</legend>
              <div className="grid gap-2">
                {packages.map((p) => (
                  <label key={p.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-focus-visible:ring-2 has-focus-visible:ring-teal-600', packageId === p.id ? 'border-teal-600 bg-teal-50/50' : 'border-line')}>
                    <input type="radio" name="pkg" checked={packageId === p.id} onChange={() => setPackageId(p.id)} className="accent-teal-600" />
                    <span className="flex-1"><span className="block text-sm font-semibold">{p.name}</span><span className="block text-xs text-muted">{p.description}</span></span>
                    <span className="font-display font-bold">{formatKES(p.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {packages.length === 1 && pkg && (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <div><p className="font-semibold">{pkg.name}</p><p className="text-sm text-muted">{pkg.description}</p></div>
              <p className="font-display text-xl font-bold">{formatKES(pkg.price)}</p>
            </div>
          )}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Payment method</legend>
            <RadioCards name="method" value={method} onChange={setMethod} columns={3} options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label, description: m.enabled ? undefined : 'Coming soon' }))} />
          </fieldset>
          <Field label="M-Pesa phone number" required hint="You’ll receive a prompt on this phone to enter your M-Pesa PIN.">
            {(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" autoComplete="tel" />}
          </Field>
          {usingMockApi && <Alert tone="info" title="Demo mode">No real money moves. Numbers ending in 0000 simulate a failed payment; 1111 simulates a cancelled one.</Alert>}
        </div>
      )}
    </Modal>
  )
}

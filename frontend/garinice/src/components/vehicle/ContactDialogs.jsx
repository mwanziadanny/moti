import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Flag, Lock } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { CONVERSATION_STARTERS, REPORT_REASONS } from '../../lib/constants'
import { cn } from '../../lib/format'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Feedback'
import { Field, Input, Textarea } from '../ui/Form'
import { Modal } from '../ui/Overlay'
import { useToast } from '../ui/Toast'

export function MessageSellerDialog({ open, onClose, vehicle }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const { isSeller } = useAuth()
  const mutation = useMutation({
    mutationFn: () => api.conversations.start(vehicle.id, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Message sent', {
        description: 'The seller will be notified. Replies appear in your inbox.',
        action: { label: 'Open conversation', onClick: () => navigate(`${isSeller ? '/dashboard/messages' : '/messages'}?c=${res.conversationId}`) },
      })
      setBody('')
      onClose()
    },
    onError: (err) => setError(err.fieldErrors?.body || err.message),
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Message the seller"
      description={vehicle.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => (body.trim().length < 2 ? setError('Write a short message to the seller') : mutation.mutate())} loading={mutation.isPending}>Send message</Button>
        </>
      }
    >
      <p className="mb-2 text-sm font-medium">Quick questions</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {CONVERSATION_STARTERS.map((s) => (
          <button key={s} type="button" onClick={() => { setBody(s); setError(null) }} className={cn('rounded-full border px-3 py-1.5 text-left text-sm transition-colors', body === s ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-line hover:border-slate-400')}>{s}</button>
        ))}
      </div>
      <Field label="Your message" error={error} required>
        {(p) => <Textarea {...p} value={body} onChange={(e) => { setBody(e.target.value); setError(null) }} rows={5} maxLength={2000} placeholder="Introduce yourself and ask about the car…" data-autofocus />}
      </Field>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Your phone number and email are not shared with the seller unless you include them in your message.</p>
    </Modal>
  )
}

export function ReportDialog({ open, onClose, vehicle }) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const mutation = useMutation({
    mutationFn: () => api.reports.create({ vehicleId: vehicle.id, reason, details, email: email || undefined }),
    onError: (err) => setError(err.message),
  })
  const close = () => {
    onClose()
    setTimeout(() => { mutation.reset(); setReason(''); setDetails(''); setError(null) }, 200)
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={mutation.isSuccess ? 'Thanks for your report' : 'Report this listing'}
      footer={mutation.isSuccess ? <Button onClick={close}>Done</Button> : (
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="danger" icon={Flag} loading={mutation.isPending} onClick={() => (reason ? mutation.mutate() : setError('Choose a reason'))}>Submit report</Button>
        </>
      )}
    >
      {mutation.isSuccess ? (
        <div className="flex gap-3 text-sm text-slate-700">
          <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden="true" />
          <p>Our moderation team will review this listing. If it breaks our rules, we’ll take action. Thank you for helping keep GariNice safe.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">What’s wrong with this listing?</legend>
            <div className="grid gap-2">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm has-focus-visible:ring-2 has-focus-visible:ring-teal-600', reason === r.value ? 'border-danger bg-red-50' : 'border-line hover:border-slate-300')}>
                  <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => { setReason(r.value); setError(null) }} className="accent-danger" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Details" optional>
            {(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} placeholder="Tell us what you noticed" />}
          </Field>
          {!user && (
            <Field label="Your email" optional hint="Only if you’d like us to follow up.">
              {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
          )}
        </div>
      )}
    </Modal>
  )
}

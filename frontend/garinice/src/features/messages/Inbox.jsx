import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, CheckCheck, MessageSquare, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Data'
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '../../components/ui/Feedback'
import { Tabs } from '../../components/ui/Navigation'
import { useToast } from '../../components/ui/Toast'
import { VehicleImage } from '../../components/vehicle/VehicleCard'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatKES, timeAgo } from '../../lib/format'

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function Thread({ id, onBack }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [body, setBody] = useState('')
  const endRef = useRef(null)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['conversation', id], queryFn: () => api.conversations.get(id), refetchInterval: 8000 })
  const send = useMutation({
    mutationFn: (text) => api.conversations.send(id, text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: ['conversation', id] })
      const prev = qc.getQueryData(['conversation', id])
      qc.setQueryData(['conversation', id], (d) => d && { ...d, messages: [...d.messages, { id: `tmp-${Date.now()}`, body: text, createdAt: new Date().toISOString(), mine: true, pending: true }] })
      setBody('')
      return { prev, text }
    },
    onError: (err, _t, ctx) => {
      qc.setQueryData(['conversation', id], ctx.prev)
      setBody(ctx.text)
      toast.error('Message not sent', { description: err.message })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['conversation', id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['unread'] })
    },
  })
  const count = data?.messages?.length
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [count])
  useEffect(() => {
    if (data) qc.invalidateQueries({ queryKey: ['unread'] })
  }, [data, qc])

  if (isLoading) return <div className="space-y-4 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className={cn('h-14 w-2/3 rounded-2xl', i % 2 && 'ml-auto')} />)}</div>
  if (error) return <div className="p-6"><ErrorState error={error} onRetry={refetch} compact /></div>
  const { conversation: c, messages } = data
  const v = c.vehicle
  const lastMine = [...messages].reverse().find((m) => m.mine && !m.pending)
  const seen = lastMine && c.otherLastReadAt && c.otherLastReadAt >= lastMine.createdAt
  const submit = (e) => {
    e?.preventDefault()
    const text = body.trim()
    if (text) send.mutate(text)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-lg hover:bg-slate-100 md:hidden" aria-label="Back to conversations"><ArrowLeft className="size-5" /></button>
        <Avatar src={c.counterpart.logoUrl} name={c.counterpart.name} square={c.counterpart.type === 'DEALER'} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold">{c.counterpart.name}{c.counterpart.verified && <BadgeCheck className="size-4 text-teal-600" aria-label="Verified" />}</p>
          <p className="text-xs text-muted">{c.side === 'buyer' ? 'Seller' : 'Interested buyer'}</p>
        </div>
      </div>
      {v && (
        <Link to={`/vehicle/${v.slug}`} className="flex items-center gap-3 border-b border-line bg-slate-50 px-4 py-2.5 hover:bg-slate-100">
          <VehicleImage image={v.image} alt="" thumb className="h-11 w-14 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{v.title}</p>
            <p className="text-xs text-muted">{formatKES(v.price)}</p>
          </div>
          {v.status !== 'PUBLISHED' && <StatusBadge status={v.status} />}
        </Link>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-5" aria-live="polite" aria-label="Messages">
        {messages.map((m, i) => {
          const showDay = i === 0 || dayLabel(messages[i - 1].createdAt) !== dayLabel(m.createdAt)
          return (
            <div key={m.id}>
              {showDay && <p className="my-4 text-center text-xs font-medium text-muted">{dayLabel(m.createdAt)}</p>}
              <div className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm', m.mine ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md border border-line bg-white text-ink', m.pending && 'opacity-60')}>
                  {m.body}
                  <span className={cn('mt-1 block text-right text-[11px]', m.mine ? 'text-brand-200' : 'text-slate-400')}>
                    {new Date(m.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        {seen && <p className="flex items-center justify-end gap-1 text-xs text-muted"><CheckCheck className="size-3.5 text-teal-600" aria-hidden="true" />Seen</p>}
        <div ref={endRef} />
      </div>
      {c.canReply ? (
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
          <label htmlFor={`compose-${id}`} className="sr-only">Write a message</label>
          <textarea
            id={`compose-${id}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Write a message…"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line px-4 py-2.5 text-[15px] focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15 focus:outline-none"
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={!body.trim()} className="h-11 w-11"><Send className="size-5" /></Button>
        </form>
      ) : <p className="border-t border-line p-4 text-center text-sm text-muted">This listing has been removed. You can no longer reply.</p>}
    </div>
  )
}

/** Two-pane inbox. `mode` = 'buyer' (/messages) or 'seller' (/dashboard/messages, shows both sides). */
export function Inbox({ mode = 'buyer' }) {
  const [params, setParams] = useSearchParams()
  const active = params.get('c')
  const { isSeller } = useAuth()
  const [side, setSide] = useState(mode === 'seller' ? 'selling' : 'all')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['conversations', side], queryFn: () => api.conversations.list(side === 'all' ? undefined : side), refetchInterval: 15000 })
  const select = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('c', id)
    else next.delete('c')
    setParams(next)
  }
  const items = data?.items || []

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[520px] overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className={cn('flex w-full shrink-0 flex-col border-r border-line md:w-80 lg:w-96', active && 'hidden md:flex')}>
        {isSeller && (
          <div className="border-b border-line px-3 pt-2">
            <Tabs value={side} onChange={setSide} tabs={[{ value: 'selling', label: 'Selling' }, { value: 'buying', label: 'Buying' }, { value: 'all', label: 'All' }]} className="border-0" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {error ? <div className="p-4"><ErrorState error={error} onRetry={refetch} compact /></div> : isLoading ? (
            <div className="space-y-1 p-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}</div>
          ) : items.length === 0 ? (
            <div className="p-4"><EmptyState icon={MessageSquare} title="No messages yet" description={side === 'selling' ? 'Buyer enquiries about your listings will appear here.' : 'When you message a seller, the conversation will appear here.'} action={side !== 'selling' && <Button to="/cars" size="sm">Browse cars</Button>} className="border-0 py-10" /></div>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {items.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => select(c.id)} aria-current={active === c.id} className={cn('flex w-full gap-3 px-4 py-3.5 text-left transition-colors', active === c.id ? 'bg-teal-50/70' : 'hover:bg-slate-50')}>
                    <div className="relative shrink-0">
                      <VehicleImage image={c.vehicle?.image} alt="" thumb className="size-12 rounded-lg" />
                      {c.unread > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-teal-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">{c.unread}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('truncate text-sm', c.unread ? 'font-bold' : 'font-semibold')}>{c.counterpart.name}</p>
                        <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessageAt)}</span>
                      </div>
                      <p className="truncate text-xs text-muted">{c.vehicle?.title}</p>
                      <p className={cn('mt-0.5 truncate text-sm', c.unread ? 'text-ink' : 'text-slate-500')}>{c.lastMessagePreview}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className={cn('min-w-0 flex-1', !active && 'hidden md:block')}>
        {active ? <Thread key={active} id={active} onBack={() => select(null)} /> : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <MessageSquare className="mx-auto size-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 font-medium">Select a conversation</p>
              <p className="text-sm text-muted">Messages are private between you and the other party.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

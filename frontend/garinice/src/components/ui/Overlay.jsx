import { X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../../hooks/useOverlay'
import { cn } from '../../lib/format'
import { Button } from './Button'
import { Field, Textarea } from './Form'

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className, hideClose }) {
  const ref = useRef(null)
  const titleId = useId()
  const descId = useId()
  useOverlay(open, onClose, ref)
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn('relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-2xl', widths[size], className)}
      >
        {(title || !hideClose) && (
          <div className="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              {title && <h2 id={titleId} className="text-lg font-bold text-ink">{title}</h2>}
              {description && <p id={descId} className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            {!hideClose && (
              <button type="button" onClick={onClose} className="-mr-2 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label="Close">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, children, footer, side = 'right', className, width = 'max-w-md' }) {
  const ref = useRef(null)
  const titleId = useId()
  useOverlay(open, onClose, ref)
  if (!open) return null
  const pos = {
    right: cn('right-0 inset-y-0 h-full w-full animate-slide-in-right', width),
    left: cn('left-0 inset-y-0 h-full w-full animate-slide-in-left', width),
    bottom: 'inset-x-0 bottom-0 max-h-[92dvh] w-full animate-slide-up rounded-t-2xl',
    full: 'inset-0 h-full w-full animate-slide-up',
  }
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 animate-fade-in bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cn('absolute flex flex-col bg-white shadow-pop outline-none', pos[side], className)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4" style={{ paddingTop: side === 'full' ? 'max(1rem, env(safe-area-inset-top))' : undefined }}>
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-line bg-white px-5 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Confirmation dialog with optional required note (e.g. rejection reason). */
export function ConfirmDialog(props) {
  // Remount on open so the note field always starts empty.
  return props.open ? <ConfirmDialogInner {...props} /> : null
}

function ConfirmDialogInner({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'primary', loading, noteLabel, noteRequired, notePlaceholder }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const submit = () => {
    if (noteRequired && !note.trim()) {
      setError('This is required')
      return
    }
    onConfirm(note.trim())
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={submit}>{confirmLabel}</Button>
        </>
      }
    >
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {noteLabel && (
        <Field label={noteLabel} required={noteRequired} error={error} className="mt-4">
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} rows={3} />}
        </Field>
      )}
    </Modal>
  )
}

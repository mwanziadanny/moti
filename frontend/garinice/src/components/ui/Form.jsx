import { ChevronDown } from 'lucide-react'
import { forwardRef, useId } from 'react'
import { cn, formatNumber } from '../../lib/format'

const control =
  'block w-full rounded-lg border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-slate-400 transition-colors ' +
  'hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-600/15 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-danger aria-invalid:focus:ring-danger/15'

export function Field({ label, hint, error, required, children, className, id: idProp, labelHidden, optional }) {
  const auto = useId()
  const id = idProp || auto
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className={cn('flex items-baseline justify-between text-sm font-medium text-ink', labelHidden && 'sr-only')}>
          <span>
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
          </span>
          {optional && <span className="text-xs font-normal text-muted">Optional</span>}
        </label>
      )}
      {typeof children === 'function' ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined }) : children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, leading, trailing, size = 'md', ...props }, ref) {
  const h = size === 'sm' ? 'h-9 text-sm' : size === 'lg' ? 'h-12' : 'h-11'
  if (!leading && !trailing) return <input ref={ref} className={cn(control, h, className)} {...props} />
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{leading}</span>}
      <input ref={ref} className={cn(control, h, leading && 'pl-12', trailing && 'pr-12', className)} {...props} />
      {trailing && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{trailing}</span>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-28 py-2.5 leading-relaxed', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, placeholder, size = 'md', ...props }, ref) {
  const h = size === 'sm' ? 'h-9 text-sm' : size === 'lg' ? 'h-12' : 'h-11'
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, h, 'appearance-none pr-10', !props.value && placeholder && 'text-slate-500', className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
    </div>
  )
})

export function Checkbox({ label, description, className, ...props }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4.5 shrink-0 rounded border-slate-300 accent-teal-600" {...props} />
      <label htmlFor={id} className="text-sm leading-5">
        <span className="text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
    </div>
  )
}

export function Switch({ checked, onChange, label, description, disabled, id: idProp }) {
  const auto = useId()
  const id = idProp || auto
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-teal-600' : 'bg-slate-300')}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}

/** Card-style radio options (keyboard accessible native radios). */
export function RadioCards({ name, value, onChange, options, columns = 2, className, error }) {
  return (
    <div role="radiogroup" aria-invalid={error ? true : undefined} className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'sm:grid-cols-2', className)}>
      {options.map((o) => {
        const checked = value === o.value
        return (
          <label
            key={o.value}
            className={cn(
              'relative flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition-all has-focus-visible:ring-2 has-focus-visible:ring-teal-600',
              checked ? 'border-teal-600 ring-1 ring-teal-600 bg-teal-50/40' : 'border-line hover:border-slate-300',
            )}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            {o.icon && <o.icon className={cn('size-6 shrink-0', checked ? 'text-teal-600' : 'text-slate-500')} aria-hidden="true" />}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{o.label}</span>
              {o.description && <span className="mt-0.5 block text-xs text-muted">{o.description}</span>}
            </span>
            <span className={cn('ml-auto mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2', checked ? 'border-teal-600' : 'border-slate-300')}>
              {checked && <span className="size-2 rounded-full bg-teal-600" />}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** Toggle chips for multi-select (features etc.). */
export function ChipToggle({ selected, onToggle, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
        selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-line bg-white text-ink hover:border-slate-400',
      )}
    >
      {label}
      {count != null && <span className={cn('text-xs', selected ? 'text-teal-100' : 'text-muted')}>{count}</span>}
    </button>
  )
}

/** Number input that formats with thousands separators but stores a raw integer string. */
export const PriceInput = forwardRef(function PriceInput({ value, onChange, prefix = 'KES', ...props }, ref) {
  const display = value === '' || value == null ? '' : formatNumber(Number(String(value).replace(/\D/g, '')))
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      leading={prefix}
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
        onChange(raw)
      }}
      {...props}
    />
  )
})

export const NumberInput = forwardRef(function NumberInput({ value, onChange, suffix, ...props }, ref) {
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      trailing={suffix}
      value={value === '' || value == null ? '' : formatNumber(Number(String(value).replace(/\D/g, '')))}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
      {...props}
    />
  )
})

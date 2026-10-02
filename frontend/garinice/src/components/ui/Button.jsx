import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/format'
import { Spinner } from './Feedback'

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm',
  accent: 'bg-amber-500 text-ink hover:bg-amber-400 active:bg-amber-600 shadow-sm font-semibold',
  teal: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:border-slate-300 hover:bg-slate-50 shadow-[0_1px_1px_rgb(15_23_42/0.04)]',
  ghost: 'text-ink hover:bg-slate-100',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-danger text-white hover:bg-red-700 shadow-sm',
  'danger-ghost': 'text-danger hover:bg-red-50',
  link: 'text-teal-600 hover:text-teal-700 underline-offset-4 hover:underline px-0! h-auto!',
}

const SIZES = {
  xs: 'h-8 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
  icon: 'h-10 w-10 rounded-lg justify-center',
  'icon-sm': 'h-8 w-8 rounded-md justify-center',
}

function buttonClasses({ variant = 'primary', size = 'md', block, className } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 select-none',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  )
}

export const Button = forwardRef(function Button(
  { variant, size, block, loading, disabled, className, children, type = 'button', to, href, icon: Icon, iconRight: IconRight, ...props },
  ref,
) {
  const cls = buttonClasses({ variant, size, block, className })
  const content = (
    <>
      {loading ? <Spinner className="size-4" /> : Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4 shrink-0" aria-hidden="true" /> : null}
    </>
  )
  if (to) {
    return (
      <Link ref={ref} to={to} className={cls} aria-disabled={disabled || undefined} {...props}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={cls} {...props}>
        {content}
      </a>
    )
  }
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  )
})

export function IconButton({ label, icon: Icon, className, variant = 'ghost', size = 'icon', ...props }) {
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} className={cn('px-0', className)} {...props}>
      <Icon className="size-5" aria-hidden="true" />
    </Button>
  )
}

import { Link } from 'react-router-dom'
import { cn } from '../../lib/format'

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#123b5d" />
      <path d="M27.5 14.2A9 9 0 1 0 29 22h-8.5" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 31.5h9" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <path d="M20.5 31.5h3" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, inverted, to = '/' }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-lg', className)} aria-label="GariNice home">
      <LogoMark />
      <span className={cn('font-display text-[21px] font-extrabold tracking-tight', inverted ? 'text-white' : 'text-ink')}>
        Gari<span className={inverted ? 'text-amber-400' : 'text-teal-600'}>Nice</span>
      </span>
    </Link>
  )
}

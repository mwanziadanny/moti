import { clsx } from 'clsx'

export const cn = (...args) => clsx(...args)

const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 })

export function formatKES(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `KES ${kes.format(value)}`
}

export function formatCompactKES(value) {
  if (value == null) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `KES ${m % 1 === 0 ? m : m.toFixed(m >= 10 ? 1 : 2).replace(/0+$/, '').replace(/\.$/, '')}M`
  }
  if (value >= 1_000) return `KES ${Math.round(value / 1_000)}K`
  return `KES ${value}`
}

export function formatNumber(value) {
  if (value == null) return '—'
  return kes.format(value)
}

export const formatMileage = (km) => (km == null ? '—' : `${kes.format(km)} km`)
export const formatEngine = (cc) => (cc == null ? '—' : `${kes.format(cc)}cc`)

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', opts)
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  const units = [
    [60 * 60 * 24 * 365, 'y'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24 * 7, 'w'],
    [60 * 60 * 24, 'd'],
    [60 * 60, 'h'],
    [60, 'm'],
  ]
  for (const [secs, label] of units) {
    if (diff >= secs) return `${Math.floor(diff / secs)}${label} ago`
  }
  return 'just now'
}

export function pluralize(n, one, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function slugify(input = '') {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function maskPhone(phone = '') {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return phone
  return `${phone.slice(0, phone.length - 6)}••• •••`
}

export function toWhatsAppNumber(phone = '') {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('0')) d = `254${d.slice(1)}`
  return d
}

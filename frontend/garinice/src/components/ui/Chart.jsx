// Lightweight, dependency-free SVG charts.
// One series per chart (one axis, no dual scales); thin marks; recessive grid;
// hover/focus tooltips; an accessible data table is always available.
import { useId, useMemo, useState } from 'react'
import { cn, formatNumber } from '../../lib/format'

const COLORS = { brand: '#123b5d', teal: '#0f766e', amber: '#b45309' }

function niceMax(v) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })

function compact(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`
  return String(Math.round(v))
}

function DataTableToggle({ label, rows, valueLabel, format }) {
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer select-none hover:text-ink">View data table</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left">
          <caption className="sr-only">{label}</caption>
          <thead className="bg-slate-50"><tr><th className="px-3 py-1.5">Label</th><th className="px-3 py-1.5 text-right">{valueLabel}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label} className="border-t border-line"><td className="px-3 py-1.5">{r.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{format(r.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  )
}

/** Area/line chart for a daily series: data = [{ date, value }] */
export function TimeSeriesChart({ data, label, valueLabel = 'Value', color = 'brand', format = formatNumber, height = 220 }) {
  const id = useId()
  const [hover, setHover] = useState(null)
  const W = 640
  const H = height
  const pad = { l: 44, r: 12, t: 12, b: 26 }
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data])
  const x = (i) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const stroke = COLORS[color] || color
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const labelEvery = Math.ceil(data.length / 6)
  const total = data.reduce((n, d) => n + d.value, 0)

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }
  const h = hover != null ? data[hover] : null

  return (
    <figure className="relative">
      <figcaption className="sr-only">{label}: total {format(total)}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y overflow-visible outline-none"
        role="img"
        aria-label={`${label}. Total ${format(total)} over ${data.length} days.`}
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0] ? { ...e, clientX: e.touches[0].clientX, currentTarget: e.currentTarget } : e)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1))
          if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? data.length) - 1))
          if (e.key === 'Escape') setHover(null)
        }}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.16" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t ? '3 4' : undefined} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#64748b">{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#64748b">{shortDate(d.date)}</text>
        ))}
        <path d={area} fill={`url(#${id}-fill)`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="#94a3b8" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.value)} r="5" fill={stroke} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? '-105%' : '5%'})` }}
          role="status"
        >
          <p className="text-muted">{new Date(h.date).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="mt-0.5 font-semibold text-ink tabular-nums">{format(h.value)} <span className="font-normal text-muted">{valueLabel.toLowerCase()}</span></p>
        </div>
      )}
      <DataTableToggle label={label} valueLabel={valueLabel} format={format} rows={data.map((d) => ({ label: d.date, value: d.value }))} />
    </figure>
  )
}

/** Horizontal ranked bar chart: data = [{ label, value }] */
export function BarList({ data, label, valueLabel = 'Count', color = 'teal', format = formatNumber, emptyText = 'No data yet' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const fill = COLORS[color] || color
  if (!data.length) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>
  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.label} className="group" title={`${d.label}: ${format(d.value)}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink">{d.label}</span>
              <span className="shrink-0 font-medium text-muted tabular-nums">{format(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={cn('h-2 rounded-full transition-[width] duration-500 group-hover:opacity-85')} style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: fill }} />
            </div>
          </li>
        ))}
      </ul>
      <DataTableToggle label={label} valueLabel={valueLabel} format={format} rows={data} />
    </figure>
  )
}

import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveImageUrl } from '../../lib/demoImages'
import { cn } from '../../lib/format'
import { useOverlay } from '../../hooks/useOverlay'
import { VehicleImage } from './VehicleCard'

function useSwipe(onLeft, onRight) {
  const start = useRef(null)
  return {
    onTouchStart: (e) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e) => {
      if (!start.current) return
      const dx = e.changedTouches[0].clientX - start.current.x
      const dy = e.changedTouches[0].clientY - start.current.y
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? onLeft : onRight)()
      start.current = null
    },
  }
}

function ImageViewer({ images, index, onIndex, onClose, title }) {
  const ref = useRef(null)
  const [zoom, setZoom] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  useOverlay(true, onClose, ref)
  const n = images.length
  const prev = useCallback(() => { setZoom(false); onIndex((index - 1 + n) % n) }, [index, n, onIndex])
  const next = useCallback(() => { setZoom(false); onIndex((index + 1) % n) }, [index, n, onIndex])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [prev, next])
  const swipe = useSwipe(next, prev)
  const img = images[index]

  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`${title} photos`} tabIndex={-1} className="fixed inset-0 z-[150] flex flex-col bg-black/95 text-white outline-none animate-fade-in">
      <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <p className="text-sm text-white/80" aria-live="polite">{index + 1} / {n}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => !z)} className="grid size-11 place-items-center rounded-lg hover:bg-white/10" aria-label={zoom ? 'Zoom out' : 'Zoom in'} aria-pressed={zoom}>
            {zoom ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg hover:bg-white/10" aria-label="Close photo viewer"><X className="size-6" /></button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" {...(zoom ? {} : swipe)}>
        <img
          key={img.id}
          src={resolveImageUrl(img.url)}
          alt={img.alt || `${title} — photo ${index + 1}`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
            setZoom((z) => !z)
          }}
          onMouseMove={(e) => {
            if (!zoom) return
            const r = e.currentTarget.getBoundingClientRect()
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
          }}
          style={{ transformOrigin: origin }}
          className={cn('max-h-full max-w-full object-contain transition-transform duration-200 select-none animate-fade-in', zoom ? 'scale-[2.2] cursor-zoom-out' : 'cursor-zoom-in')}
          draggable={false}
        />
        {n > 1 && (
          <>
            <button type="button" onClick={prev} className="absolute left-2 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:left-6" aria-label="Previous photo"><ChevronLeft className="size-7" /></button>
            <button type="button" onClick={next} className="absolute right-2 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:right-6" aria-label="Next photo"><ChevronRight className="size-7" /></button>
          </>
        )}
      </div>
      <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3 scrollbar-none" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {images.map((im, i) => (
          <button key={im.id} type="button" onClick={() => { setZoom(false); onIndex(i) }} aria-label={`Photo ${i + 1}`} aria-current={i === index} className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition-opacity', i === index ? 'opacity-100 ring-amber-400' : 'opacity-50 ring-transparent hover:opacity-80')}>
            <img src={resolveImageUrl(im.thumb || im.url)} alt="" className="size-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

export function Gallery({ images = [], title, sold }) {
  const [index, setIndex] = useState(0)
  const [viewer, setViewer] = useState(false)
  const n = images.length
  const prev = () => setIndex((i) => (i - 1 + n) % n)
  const next = () => setIndex((i) => (i + 1) % n)
  const swipe = useSwipe(next, prev)
  const stripRef = useRef(null)
  useEffect(() => {
    stripRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [index])

  if (!n) return <VehicleImage image={null} className="aspect-[4/3] w-full rounded-xl" />

  return (
    <div>
      <div
        className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') prev()
          if (e.key === 'ArrowRight') next()
          if (e.key === 'Enter') setViewer(true)
        }}
        {...swipe}
      >
        {images.map((img, i) => (
          <div key={img.id} className={cn('absolute inset-0 transition-opacity duration-300', i === index ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={i !== index}>
            {Math.abs(i - index) <= 1 || i === 0 ? (
              <button type="button" className="size-full cursor-zoom-in" onClick={() => setViewer(true)} tabIndex={-1} aria-label="Open fullscreen photo viewer">
                <VehicleImage image={img} alt={img.alt || `${title} — photo ${i + 1} of ${n}`} priority={i === 0} sizes="(min-width:1024px) 60vw, 100vw" className={cn('size-full', sold && 'grayscale-[30%]')} />
              </button>
            ) : null}
          </div>
        ))}
        {sold && <div className="pointer-events-none absolute top-5 -left-12 w-48 -rotate-45 bg-danger py-1.5 text-center text-sm font-bold tracking-widest text-white shadow">SOLD</div>}
        {n > 1 && (
          <>
            <button type="button" onClick={prev} className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" aria-label="Previous photo"><ChevronLeft className="size-6" /></button>
            <button type="button" onClick={next} className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" aria-label="Next photo"><ChevronRight className="size-6" /></button>
          </>
        )}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <span className="rounded-md bg-ink/70 px-2 py-1 text-xs font-medium text-white" aria-live="polite">{index + 1} / {n}</span>
          <button type="button" onClick={() => setViewer(true)} className="grid size-8 place-items-center rounded-md bg-ink/70 text-white hover:bg-ink" aria-label="View fullscreen"><Expand className="size-4" /></button>
        </div>
      </div>
      {n > 1 && (
        <div ref={stripRef} className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index} className={cn('h-16 w-[86px] shrink-0 overflow-hidden rounded-lg ring-2 ring-offset-1 transition sm:h-[72px] sm:w-24', i === index ? 'ring-teal-600' : 'ring-transparent opacity-70 hover:opacity-100')}>
              <img src={resolveImageUrl(img.thumb || img.url)} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {viewer && <ImageViewer images={images} index={index} onIndex={setIndex} onClose={() => setViewer(false)} title={title} />}
    </div>
  )
}

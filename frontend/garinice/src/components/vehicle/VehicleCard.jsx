import { BadgeCheck, Camera, Fuel, Gauge, Heart, MapPin, Settings2, Sparkles, Zap } from 'lucide-react'
import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFavouriteIds, useToggleFavourite } from '../../hooks/queries'
import { resolveImageUrl } from '../../lib/demoImages'
import { cn, formatEngine, formatKES, formatMileage } from '../../lib/format'
import { Badge, Skeleton } from '../ui/Feedback'

export function VehicleImage({ image, alt, className, sizes = '(min-width:1280px) 25vw, (min-width:768px) 33vw, 100vw', priority, thumb }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!image || failed) {
    return (
      <div className={cn('grid place-items-center bg-slate-100 text-slate-400', className)}>
        <Camera className="size-8" aria-hidden="true" />
        <span className="sr-only">No photo available</span>
      </div>
    )
  }
  const src = resolveImageUrl(thumb && image.thumb ? image.thumb : image.url)
  const srcSet = image.thumb && !image.url.startsWith('demo:') ? `${image.thumb} 480w, ${image.url} 1600w` : undefined
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={image.width || 800}
      height={image.height || 600}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn('bg-slate-100 object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
    />
  )
}

export function FavouriteButton({ vehicleId, className, size = 'md', withLabel }) {
  const { data: ids } = useFavouriteIds()
  const toggle = useToggleFavourite()
  const saved = !!ids?.has(vehicleId)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(vehicleId, saved)
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved cars' : 'Save this car'}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all active:scale-95',
        withLabel
          ? 'h-11 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-slate-50'
          : cn('rounded-full bg-white/95 shadow-md backdrop-blur hover:bg-white', size === 'sm' ? 'size-8' : 'size-10'),
        className,
      )}
    >
      <Heart className={cn(size === 'sm' ? 'size-4' : 'size-5', saved ? 'fill-danger text-danger' : 'text-slate-700')} aria-hidden="true" />
      {withLabel && (saved ? 'Saved' : 'Save')}
    </button>
  )
}

function Spec({ icon: Icon, children }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </li>
  )
}

export const VehicleCard = memo(function VehicleCard({ vehicle: v, priority, layout = 'grid', footer }) {
  const sold = v.status === 'SOLD'
  const sellerLabel = v.seller?.type === 'DEALER' ? v.seller.name : v.seller?.type === 'AGENT' ? 'Agent listing' : 'Private seller'
  const titleMain = [v.year, v.make, v.model].filter(Boolean).join(' ')
  const list = layout === 'list'
  return (
    <article className={cn('group relative flex overflow-hidden rounded-xl border border-line bg-white shadow-card transition-shadow hover:shadow-lift', list ? 'flex-col sm:flex-row' : 'flex-col')}>
      <div className={cn('relative overflow-hidden bg-slate-100', list ? 'aspect-[4/3] sm:aspect-auto sm:w-72 sm:shrink-0' : 'aspect-[4/3]')}>
        <VehicleImage image={v.image} alt={v.title} priority={priority} thumb className={cn('size-full transition-transform duration-500 group-hover:scale-[1.03]', sold && 'grayscale-[40%]')} />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {sold && <Badge tone="danger" className="bg-danger text-white ring-danger">SOLD</Badge>}
          {!sold && v.featured && <Badge tone="accent" icon={Sparkles}>Featured</Badge>}
          {!sold && v.importStatus === 'DIRECT_IMPORT' && <Badge tone="dark">Direct import</Badge>}
        </div>
        <div className="absolute top-3 right-3 z-10"><FavouriteButton vehicleId={v.id} /></div>
        {v.imageCount > 1 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <Camera className="size-3" aria-hidden="true" /> {v.imageCount}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <h3 className="min-w-0 font-display text-[17px] leading-snug font-bold text-ink">
          <Link to={`/vehicle/${v.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-teal-600">
            <span className="line-clamp-1">{titleMain}</span>
          </Link>
        </h3>
        <p className="line-clamp-1 min-h-5 text-sm text-muted">{v.variant || v.bodyType}</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-slate-600">
          <Spec icon={Gauge}>{formatMileage(v.mileageKm)}</Spec>
          <Spec icon={Zap}>{formatEngine(v.engineCc)}</Spec>
          <Spec icon={Fuel}>{v.fuel}</Spec>
          <Spec icon={Settings2}>{v.transmission}</Spec>
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={v.condition === 'BRAND_NEW' ? 'success' : v.condition === 'FOREIGN_USED' ? 'teal' : 'brand'}>{v.conditionLabel}</Badge>
          {v.importStatus === 'IN_TRANSIT' && <Badge tone="info">In transit</Badge>}
        </div>
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className={cn('font-display text-xl font-extrabold tracking-tight tabular-nums', sold ? 'text-slate-400 line-through decoration-1' : 'text-brand-700')}>{formatKES(v.price)}</p>
            {v.negotiable && !sold && <span className="text-xs font-medium text-teal-700">Negotiable</span>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium text-slate-700">{sellerLabel}</span>
              {v.seller?.verified && <BadgeCheck className="size-4 shrink-0 text-teal-600" aria-label="Verified" />}
            </span>
            <span className="flex shrink-0 items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{v.town}</span>
          </div>
          {footer}
        </div>
      </div>
    </article>
  )
})

export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white" aria-hidden="true">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-3.5 w-20" />)}
        </div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3.5 w-full" />
      </div>
    </div>
  )
}

export function VehicleGrid({ vehicles, loading, count = 8, className, cols = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' }) {
  return (
    <div className={cn('grid gap-4 sm:gap-5', cols, className)}>
      {loading
        ? Array.from({ length: count }, (_, i) => <VehicleCardSkeleton key={i} />)
        : vehicles.map((v, i) => <VehicleCard key={v.id} vehicle={v} priority={i < 2} />)}
    </div>
  )
}

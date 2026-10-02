import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { Alert } from '../../components/ui/Feedback'
import { resolveImageUrl } from '../../lib/demoImages'
import { LIMITS } from '../../lib/constants'
import { cn } from '../../lib/format'
import { processImage } from '../../lib/image'

/**
 * Multi-image uploader: drag & drop or browse, client-side resize to WebP (EXIF
 * stripped), upload, then reorder (drag or arrow buttons), delete and set primary.
 * The first image is the primary/cover photo.
 */
export function ImageUploader({ images, onChange, error }) {
  const [pending, setPending] = useState([]) // { key, name }
  const [errors, setErrors] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const inputRef = useRef(null)
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])

  const handleFiles = async (fileList) => {
    const files = [...fileList]
    const room = LIMITS.maxImages - imagesRef.current.length - pending.length
    const errs = []
    if (files.length > room) errs.push(`You can add ${Math.max(room, 0)} more photo${room === 1 ? '' : 's'} (maximum ${LIMITS.maxImages}).`)
    const batch = files.slice(0, Math.max(room, 0)).map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, file: f }))
    setPending((p) => [...p, ...batch.map(({ key, file }) => ({ key, name: file.name }))])
    for (const { key, file } of batch) {
      try {
        const { full, thumb } = await processImage(file)
        const up = await api.vehicles.upload({ kind: 'image', dataUrl: full.data, thumbDataUrl: thumb.data, width: full.width, height: full.height, name: file.name })
        imagesRef.current = [...imagesRef.current, { id: up.id, url: up.url, thumb: up.thumb, width: up.width, height: up.height, alt: '' }]
        onChange(imagesRef.current)
      } catch (err) {
        errs.push(err.message || `${file.name}: upload failed. Please try again.`)
      } finally {
        setPending((p) => p.filter((x) => x.key !== key))
      }
    }
    setErrors(errs)
  }

  const move = (from, to) => {
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn('flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', dragOver ? 'border-teal-600 bg-teal-50' : error ? 'border-danger bg-red-50/40' : 'border-slate-300 bg-slate-50')}
      >
        <UploadCloud className="size-10 text-slate-400" aria-hidden="true" />
        <p className="mt-3 font-semibold">Drag photos here or <button type="button" onClick={() => inputRef.current?.click()} className="text-teal-700 underline underline-offset-2">browse</button></p>
        <p className="mt-1 text-sm text-muted">JPG, PNG, WebP or AVIF · up to {LIMITS.maxImageBytes / 1024 / 1024}MB each · {images.length}/{LIMITS.maxImages} photos</p>
        <p className="mt-1 text-xs text-muted">Photos are resized and location data is removed automatically.</p>
        <input ref={inputRef} type="file" accept={LIMITS.acceptedImageTypes.join(',')} multiple className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} aria-label="Upload vehicle photos" />
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      {errors.length > 0 && <Alert tone="danger" title="Some photos couldn’t be added"><ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}

      {(images.length > 0 || pending.length > 0) && (
        <>
          <p className="text-sm text-muted">Drag to reorder. The first photo is your cover photo — choose one that shows the whole car.</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Uploaded photos">
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { if (dragIndex != null) e.preventDefault() }}
                onDrop={(e) => { e.preventDefault(); if (dragIndex != null) move(dragIndex, i); setDragIndex(null) }}
                onDragEnd={() => setDragIndex(null)}
                className={cn('group relative aspect-[4/3] cursor-grab overflow-hidden rounded-lg border bg-slate-100 active:cursor-grabbing', i === 0 ? 'border-amber-500 ring-2 ring-amber-500' : 'border-line', dragIndex === i && 'opacity-40')}
              >
                <img src={resolveImageUrl(img.thumb || img.url)} alt={`Photo ${i + 1}`} className="size-full object-cover" draggable={false} />
                {i === 0 && <span className="absolute top-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-ink">COVER</span>}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="grid size-7 place-items-center rounded bg-white/90 text-ink disabled:opacity-30" aria-label={`Move photo ${i + 1} earlier`}><ArrowLeft className="size-4" /></button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} className="grid size-7 place-items-center rounded bg-white/90 text-ink disabled:opacity-30" aria-label={`Move photo ${i + 1} later`}><ArrowRight className="size-4" /></button>
                  </div>
                  <div className="flex gap-1">
                    {i !== 0 && <button type="button" onClick={() => move(i, 0)} className="grid size-7 place-items-center rounded bg-white/90 text-amber-600" aria-label={`Set photo ${i + 1} as cover`}><Star className="size-4" /></button>}
                    <button type="button" onClick={() => onChange(images.filter((x) => x.id !== img.id))} className="grid size-7 place-items-center rounded bg-white/90 text-danger" aria-label={`Delete photo ${i + 1}`}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </li>
            ))}
            {pending.map((p) => (
              <li key={p.key} className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-line bg-white text-center text-xs text-muted">
                <span><Loader2 className="mx-auto mb-1 size-5 animate-spin text-teal-600" aria-hidden="true" />Processing…<span className="block max-w-28 truncate">{p.name}</span></span>
              </li>
            ))}
            {images.length + pending.length < LIMITS.maxImages && (
              <li>
                <button type="button" onClick={() => inputRef.current?.click()} className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-dashed border-slate-300 text-sm text-muted hover:border-teal-600 hover:text-teal-700">
                  <span><ImagePlus className="mx-auto mb-1 size-6" aria-hidden="true" />Add more</span>
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}

// Client-side image pre-processing before upload: validates type/size, honours EXIF
// orientation, then re-encodes through a canvas (which strips EXIF/GPS metadata) to
// WebP at a capped resolution plus a thumbnail. The server must re-validate and
// generate its own responsive variants (WebP/AVIF) — never trust client output.
import { LIMITS } from './constants'

export class ImageValidationError extends Error {}

export function validateImageFile(file) {
  if (!LIMITS.acceptedImageTypes.includes(file.type)) {
    throw new ImageValidationError(`${file.name}: only JPG, PNG, WebP or AVIF images are allowed`)
  }
  if (file.size > LIMITS.maxImageBytes) {
    throw new ImageValidationError(`${file.name}: images must be under ${LIMITS.maxImageBytes / 1024 / 1024}MB`)
  }
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function render(source, maxEdge, quality) {
  const w = source.width
  const h = source.height
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  let data = canvas.toDataURL('image/webp', quality)
  if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', quality)
  return { data, width: canvas.width, height: canvas.height }
}

export async function processImage(file) {
  validateImageFile(file)
  const source = await decode(file)
  if (source.width < 400 || source.height < 300) {
    throw new ImageValidationError(`${file.name}: image is too small (minimum 400×300px)`)
  }
  const full = render(source, 1600, 0.82)
  const thumb = render(source, 480, 0.75)
  source.close?.()
  return { full, thumb }
}

export async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Original, generated placeholder vehicle renders for demo/seed data.
// URL format: demo:<bodySlug>/<hexColour without #>/<variant>
// Real uploads are normal URLs (object storage / CDN) and pass straight through.

const SHAPES = {
  // xr: rear, xf: front, belt: hood/beltline y, tail: rear deck y, roof: roof y,
  // a: windshield base x, b: roof front x, c: roof rear x, d: rear glass base x, r: wheel radius
  suv: { xr: 105, xf: 700, belt: 292, tail: 292, roof: 196, a: 545, b: 470, c: 150, d: 118, r: 62, bottom: 405 },
  saloon: { xr: 95, xf: 710, belt: 318, tail: 305, roof: 228, a: 520, b: 440, c: 265, d: 190, r: 54, bottom: 400 },
  hatchback: { xr: 140, xf: 670, belt: 316, tail: 300, roof: 220, a: 505, b: 430, c: 195, d: 152, r: 54, bottom: 400 },
  'station-wagon': { xr: 95, xf: 710, belt: 316, tail: 300, roof: 222, a: 525, b: 445, c: 130, d: 108, r: 54, bottom: 400 },
  'pickup-truck': { xr: 95, xf: 710, belt: 296, tail: 296, roof: 196, a: 560, b: 490, c: 345, d: 345, r: 62, bottom: 408 },
  'van-bus': { xr: 110, xf: 700, belt: 290, tail: 290, roof: 150, a: 640, b: 585, c: 118, d: 112, r: 56, bottom: 405 },
  'sports-car': { xr: 105, xf: 715, belt: 336, tail: 318, roof: 252, a: 495, b: 425, c: 285, d: 190, r: 52, bottom: 398 },
  other: { xr: 110, xf: 700, belt: 318, tail: 305, roof: 230, a: 520, b: 440, c: 265, d: 190, r: 54, bottom: 400 },
}

const SCENES = [
  { bg1: '#f4f6f9', bg2: '#dfe5ec', floor: '#cfd7e0', mirror: false, zoom: 1 },
  { bg1: '#f7f3ee', bg2: '#e6ddd2', floor: '#d6cabb', mirror: true, zoom: 1 },
  { bg1: '#22313f', bg2: '#0f1a24', floor: '#0b141c', mirror: false, zoom: 1, dark: true },
  { bg1: '#cfe3f3', bg2: '#eef5fb', floor: '#9aa6b2', mirror: true, zoom: 1, road: true },
  { bg1: '#eef1f4', bg2: '#d9dfe6', floor: '#c8d0d9', mirror: false, zoom: 1.55, focus: 'front' },
  { bg1: '#ece9f1', bg2: '#d9d4e2', floor: '#c7c0d3', mirror: true, zoom: 1.55, focus: 'rear' },
]

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16)
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const r = clamp((n >> 16) + amt)
  const g = clamp(((n >> 8) & 0xff) + amt)
  const b = clamp((n & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function carSvg(body, colour, s) {
  const p = SHAPES[body] || SHAPES.other
  const { xr, xf, belt, tail, roof, a, b, c, d, r, bottom } = p
  const w1 = xr + 125
  const w2 = xf - 120
  const wheelY = bottom - 4
  const light = shade(colour, 38)
  const dark = shade(colour, -45)
  const glass = s.dark ? '#5d7387' : '#2b3a48'
  const bodyPath = [
    `M${xr},${bottom - 18}`,
    `L${xr},${tail + 18}`,
    `Q${xr},${tail} ${xr + 22},${tail}`,
    `L${d},${tail}`,
    `L${c},${roof}`,
    `L${b},${roof}`,
    `L${a},${belt}`,
    `L${xf - 40},${belt + 6}`,
    `Q${xf},${belt + 12} ${xf},${belt + 42}`,
    `L${xf},${bottom - 18}`,
    `Q${xf},${bottom} ${xf - 18},${bottom}`,
    `L${xr + 18},${bottom}`,
    `Q${xr},${bottom} ${xr},${bottom - 18}Z`,
  ].join(' ')
  const winY = Math.min(belt, tail) - 7
  const mid = Math.round((b + c) / 2)
  const pillar = d === c ? 0 : 1
  const win1 = `M${a - 14},${winY} L${b - 4},${roof + 11} L${mid + 8},${roof + 11} L${mid + 8},${winY}Z`
  const win2 = `M${mid - 8},${winY} L${mid - 8},${roof + 11} L${c + 6 * pillar},${roof + 11} L${d + 14 * pillar},${winY}Z`
  const wheel = (cx) => `
    <circle cx="${cx}" cy="${wheelY}" r="${r + 9}" fill="${dark}"/>
    <circle cx="${cx}" cy="${wheelY}" r="${r}" fill="#1a1d21"/>
    <circle cx="${cx}" cy="${wheelY}" r="${r * 0.62}" fill="#9aa3ad"/>
    <circle cx="${cx}" cy="${wheelY}" r="${r * 0.5}" fill="#c4cad1"/>
    ${[0, 72, 144, 216, 288].map((deg) => `<rect x="${cx - 4}" y="${wheelY - r * 0.5}" width="8" height="${r * 0.5}" fill="#8b949e" transform="rotate(${deg} ${cx} ${wheelY})"/>`).join('')}
    <circle cx="${cx}" cy="${wheelY}" r="${r * 0.13}" fill="#5b636c"/>`
  const bed = body === 'pickup-truck' ? `<rect x="${xr + 8}" y="${tail - 2}" width="${c - xr - 16}" height="6" fill="${dark}"/>` : ''
  return `
    <ellipse cx="${(xr + xf) / 2}" cy="${bottom + 22}" rx="${(xf - xr) / 1.8}" ry="20" fill="#000" opacity="${s.dark ? 0.55 : 0.18}"/>
    <path d="${bodyPath}" fill="${colour}"/>
    <path d="M${xr + 4},${(belt + bottom) / 2 + 6} L${xf - 4},${(belt + bottom) / 2 + 6}" stroke="${dark}" stroke-width="3" opacity=".55"/>
    <path d="M${xr},${tail + 10} L${xf},${belt + 14}" stroke="${light}" stroke-width="6" opacity=".55"/>
    <path d="${win1}" fill="${glass}"/>
    ${d === c && body === 'pickup-truck' ? '' : `<path d="${win2}" fill="${glass}"/>`}
    <path d="M${a - 30},${winY - 10} L${b + 10},${roof + 16}" stroke="#fff" stroke-width="6" opacity=".12"/>
    <rect x="${xf - 26}" y="${belt + 16}" width="22" height="13" rx="5" fill="#fff6d6"/>
    <rect x="${xr}" y="${tail + 12}" width="14" height="18" rx="3" fill="#c0262d"/>
    <rect x="${mid - 40}" y="${(belt + bottom) / 2 - 12}" width="24" height="5" rx="2" fill="${dark}"/>
    ${bed}
    ${wheel(w1)}
    ${wheel(w2)}`
}

const cache = new Map()

export function demoImage(url) {
  if (cache.has(url)) return cache.get(url)
  const [, rest] = url.split(':')
  const [body = 'saloon', colourRaw = '1e3a5f', variantRaw = '0'] = (rest || '').split('/')
  const colour = `#${colourRaw}`
  const s = SCENES[Number(variantRaw) % SCENES.length]
  const W = 800
  const H = 600
  let transform = s.mirror ? `translate(${W},0) scale(-1,1)` : ''
  if (s.zoom !== 1) {
    const focusX = s.focus === 'front' ? 560 : 240
    const tx = W / 2 - focusX * s.zoom
    const ty = H / 2 - 330 * s.zoom
    transform += ` translate(${tx},${ty}) scale(${s.zoom})`
  }
  const road = s.road
    ? `<rect y="420" width="${W}" height="180" fill="#7c8793"/><rect y="500" width="${W}" height="6" fill="#e5e7eb" opacity=".7"/>`
    : `<rect y="420" width="${W}" height="180" fill="url(#f)"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.bg2}"/><stop offset="1" stop-color="${s.bg1}"/></linearGradient>
      <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.floor}"/><stop offset="1" stop-color="${s.bg1}"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${road}
    <g transform="${transform.trim()}">${carSvg(body, colour, s)}</g>
    <text x="${W - 20}" y="${H - 18}" text-anchor="end" font-family="system-ui,sans-serif" font-size="15" fill="${s.dark ? '#ffffff' : '#0f172a'}" opacity=".35">Demo image</text>
  </svg>`
  const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  cache.set(url, data)
  return data
}

export function resolveImageUrl(url) {
  if (!url) return ''
  return url.startsWith('demo:') ? demoImage(url) : url
}

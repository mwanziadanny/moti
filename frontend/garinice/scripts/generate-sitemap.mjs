// Generates public/sitemap.xml (index) + per-type sitemaps from the demo seed.
// In production the backend serves these dynamically from the database
// (GET /sitemap.xml, /sitemaps/vehicles.xml, …) — see docs/ARCHITECTURE.md.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = (process.env.VITE_SITE_URL || 'https://garinice.co.ke').replace(/\/$/, '')

const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
try {
  const { createSeed } = await vite.ssrLoadModule('/src/api/mock/seed.js')
  const { PRICE_PRESETS } = await vite.ssrLoadModule('/src/lib/constants.js')
  const db = await createSeed()
  const today = new Date().toISOString().slice(0, 10)
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const urlset = (urls) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${esc(SITE + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}${u.priority ? `<priority>${u.priority}</priority>` : ''}</url>`)
      .join('\n')}\n</urlset>\n`

  const pages = ['/', '/cars', '/sell', '/dealers', '/how-it-works', '/about', '/faq', '/safety', '/help', '/contact', '/terms', '/privacy']
  const sitemaps = {
    'sitemap-pages.xml': pages.map((path) => ({ path, priority: path === '/' ? '1.0' : '0.6' })),
    'sitemap-categories.xml': [
      ...db.brands.filter((b) => b.active).map((b) => ({ path: `/cars/${b.slug}`, priority: '0.8' })),
      ...db.bodyTypes.map((b) => ({ path: `/cars/body/${b.slug}`, priority: '0.8' })),
      ...PRICE_PRESETS.map((p) => ({ path: `/cars/price/${p.slug}`, priority: '0.7' })),
    ],
    'sitemap-dealers.xml': db.dealers.filter((d) => !d.deletedAt && !d.suspended).map((d) => ({ path: `/dealer/${d.slug}`, lastmod: d.createdAt, priority: '0.6' })),
    'sitemap-vehicles.xml': db.vehicles.filter((v) => v.status === 'PUBLISHED' && !v.deletedAt).map((v) => ({ path: `/vehicle/${v.slug}`, lastmod: v.updatedAt, priority: '0.7' })),
  }
  const out = resolve(root, 'public')
  await mkdir(out, { recursive: true })
  for (const [file, urls] of Object.entries(sitemaps)) await writeFile(resolve(out, file), urlset(urls))
  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(sitemaps)
    .map((f) => `  <sitemap><loc>${SITE}/${f}</loc><lastmod>${today}</lastmod></sitemap>`)
    .join('\n')}\n</sitemapindex>\n`
  await writeFile(resolve(out, 'sitemap.xml'), index)
  console.log(`sitemap: ${Object.entries(sitemaps).map(([f, u]) => `${f}=${u.length}`).join(', ')}`)
} finally {
  await vite.close()
}

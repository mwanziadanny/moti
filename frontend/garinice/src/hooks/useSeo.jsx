// Per-route SEO. React 19 hoists <title>/<meta>/<link> into <head>. For crawlers that
// don't execute JS, the production deployment pre-renders routes (see docs/ARCHITECTURE.md).
import { useLocation } from 'react-router-dom'
import { SITE } from '../lib/constants'

export function Seo({ title, description, canonical, image, noindex, jsonLd, type = 'website' }) {
  const { pathname } = useLocation()
  const fullTitle = title ? (title.includes(SITE.name) ? title : `${title} | ${SITE.name}`) : `${SITE.name} — ${SITE.tagline}`
  const url = `${SITE.url}${canonical || pathname}`
  const img = image && !image.startsWith('data:') && !image.startsWith('demo:') ? image : `${SITE.url}/og-default.png`
  const desc = description || 'Buy and sell new and used cars in Kenya. Search thousands of vehicles from verified dealers and private sellers on GariNice.'
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,follow" />}
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:locale" content="en_KE" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  )
}

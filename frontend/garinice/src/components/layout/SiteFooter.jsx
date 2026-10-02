import { Link } from 'react-router-dom'
import { useTaxonomy } from '../../hooks/queries'
import { SITE } from '../../lib/constants'
import { Logo } from './Logo'

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/', d: 'M14 8h3V4h-3c-2.8 0-4.5 1.9-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.8-.8Z' },
  { label: 'Instagram', href: 'https://www.instagram.com/', d: 'M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 7.2c-.1-1.5-.4-2.8-1.5-3.8S17.3 2 15.8 2 9.7 1.9 8.2 2 5.4 2.4 4.4 3.4 3 5.7 3 7.2s-.1 7.6 0 9.1.4 2.8 1.4 3.8 2.3 1.3 3.8 1.4 6.1.1 7.6 0 2.8-.4 3.8-1.4 1.3-2.3 1.4-3.8.1-7.6 0-9.1Zm-2 10.8a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.3.4s-4.1.1-5.3-.4A3 3 0 0 1 5 18c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3A3 3 0 0 1 6.7 5.7C7.9 5.2 10.7 5.3 12 5.3s4.1-.1 5.3.4A3 3 0 0 1 19 7.4c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3Z' },
  { label: 'X (Twitter)', href: 'https://x.com/', d: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z' },
  { label: 'TikTok', href: 'https://www.tiktok.com/', d: 'M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z' },
  { label: 'YouTube', href: 'https://www.youtube.com/', d: 'M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15V9l5.8 3-5.8 3Z' },
]

function FooterCol({ title, links }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map(([to, label]) => (
          <li key={to + label}><Link to={to} className="text-sm text-slate-300 hover:text-white hover:underline">{label}</Link></li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  const { data: tax } = useTaxonomy()
  const brands = (tax?.brands || []).filter((b) => b.popular).slice(0, 8)
  const bodies = (tax?.bodyTypes || []).filter((b) => b.slug !== 'other')
  return (
    <footer className="mt-auto bg-brand-900 text-slate-300">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_repeat(5,1fr)]">
          <div className="max-w-xs">
            <Logo inverted />
            <p className="mt-4 text-sm leading-6 text-slate-400">Kenya’s marketplace for new and used cars. Compare thousands of vehicles from dealers and private sellers in one place.</p>
            <ul className="mt-6 flex gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`GariNice on ${s.label}`} className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white">
                    <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden="true"><path d={s.d} /></svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <FooterCol title="Marketplace" links={[['/cars', 'Browse Cars'], ['/sell', 'Sell Your Car'], ['/dealers', 'Dealers'], ['/how-it-works', 'How It Works'], ['/saved', 'Saved cars']]} />
          <FooterCol title="Company" links={[['/about', 'About'], ['/faq', 'FAQ'], ['/safety', 'Safety'], ['/contact', 'Contact'], ['/help', 'Help centre']]} />
          <FooterCol title="Popular brands" links={brands.map((b) => [`/cars/${b.slug}`, `${b.name} for sale`])} />
          <FooterCol title="Body types" links={bodies.map((b) => [`/cars/body/${b.slug}`, b.plural])} />
          <FooterCol
            title="Popular searches"
            links={[
              ['/cars/price/under-1m', 'Cars under 1M'],
              ['/cars/price/under-2m', 'Cars under 2M'],
              ['/cars/price/2m-5m', 'Cars 2M – 5M'],
              ['/cars?make=toyota&model=land-cruiser-prado', 'Toyota Prado'],
              ['/cars?fuel=hybrid', 'Hybrid cars'],
              ['/cars?condition=foreign-used', 'Foreign used'],
            ]}
          />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/safety" className="hover:text-white">Safety</Link>
            <Link to="/sitemap" className="hover:text-white">Sitemap</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

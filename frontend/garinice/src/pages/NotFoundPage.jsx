import { Car, MapPinOff, Store } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { SearchAutocomplete } from '../components/search/SearchAutocomplete'
import { Seo } from '../hooks/useSeo'

const COPY = {
  page: { icon: MapPinOff, title: 'We can’t find that page', body: 'The link may be broken or the page may have moved.' },
  vehicle: { icon: Car, title: 'This car is no longer listed', body: 'It may have been sold, removed by the seller, or the link is incorrect. Similar cars are probably still available.' },
  dealer: { icon: Store, title: 'Dealer not found', body: 'This dealership may have changed its name or is no longer on GariNice.' },
}

export default function NotFoundPage({ kind = 'page' }) {
  const c = COPY[kind]
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <Seo title={c.title} noindex />
      <p className="font-display text-sm font-bold tracking-widest text-teal-700">404</p>
      <div className="mt-4 grid size-16 place-items-center rounded-full bg-brand-50 text-brand-700"><c.icon className="size-8" aria-hidden="true" /></div>
      <h1 className="mt-5 text-3xl font-bold">{c.title}</h1>
      <p className="mt-3 max-w-md text-muted">{c.body}</p>
      <div className="mt-8 w-full max-w-lg"><SearchAutocomplete /></div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button to="/cars">Browse all cars</Button>
        <Button variant="secondary" to="/">Go to homepage</Button>
      </div>
    </div>
  )
}

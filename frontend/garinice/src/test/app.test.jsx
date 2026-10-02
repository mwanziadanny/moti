// UI integration tests: real routes + components + mock backend (same REST contract).
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getMockServer } from '../api/mock/server'
import { renderApp, signInAs, signOut } from './renderApp'

const T = { timeout: 10000 }
let server

beforeAll(async () => {
  server = await getMockServer()
})
afterEach(() => signOut())

const firstPublished = (pred = () => true) => server.db.vehicles.find((v) => v.status === 'PUBLISHED' && !v.deletedAt && pred(v))

describe('public marketplace', () => {
  it('renders the homepage with hero search, featured and latest listings', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: /find your next car/i }, T)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search cars/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /latest listings/i }, T)).toBeInTheDocument()
    expect((await screen.findAllByRole('article', {}, T)).length).toBeGreaterThan(4)
  })

  it('searches Toyota Prado via URL filters and opens a vehicle', async () => {
    const { user, router } = renderApp('/cars?make=toyota&model=land-cruiser-prado')
    expect(await screen.findByRole('heading', { level: 1, name: /toyota land cruiser prado/i }, T)).toBeInTheDocument()
    const cards = await screen.findAllByRole('article', {}, T)
    expect(cards.length).toBeGreaterThan(0)
    for (const c of cards) expect(c).toHaveTextContent(/Land Cruiser Prado/)
    await user.click(within(cards[0]).getAllByRole('link')[0])
    expect(await screen.findByRole('heading', { name: /specifications/i }, T)).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/vehicle\//)
    expect(screen.getAllByText(/KES/).length).toBeGreaterThan(0)
  })

  it('removing a filter chip updates the URL and results', async () => {
    const { user, router } = renderApp('/cars?make=toyota&body=suv')
    await screen.findAllByRole('article', {}, T)
    await user.click(screen.getByRole('button', { name: /remove filter suv/i }))
    await waitFor(() => expect(router.state.location.search).toBe('?make=toyota'))
  })

  it('renders SEO landing pages with real market statistics', async () => {
    renderApp('/cars/body/suv')
    expect(await screen.findByRole('heading', { level: 1, name: /suvs for sale in kenya/i }, T)).toBeInTheDocument()
    expect(await screen.findByText(/market snapshot/i, {}, T)).toBeInTheDocument()
  })

  it('shows a helpful 404 for unknown vehicles and makes', async () => {
    renderApp('/vehicle/does-not-exist-123')
    expect(await screen.findByText(/this car is no longer listed/i, {}, T)).toBeInTheDocument()
  })

  it('renders a dealer storefront', async () => {
    renderApp('/dealer/axis-motors')
    expect(await screen.findByRole('heading', { level: 1, name: 'Axis Motors' }, T)).toBeInTheDocument()
    expect(screen.getByText(/verified dealer/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /inventory/i }, T)).toBeInTheDocument()
  })

  it('renders CMS pages such as the FAQ', async () => {
    renderApp('/faq')
    expect(await screen.findByText(/do i need an account to browse cars/i, {}, T)).toBeInTheDocument()
  })
})

describe('authentication-gated journeys', () => {
  it('prompts to sign in when saving a car, then saves it after login without leaving the page', async () => {
    const buyerId = server.db.users.find((u) => u.email === 'buyer@example.com').id
    const v = firstPublished((x) => !server.db.favourites.some((f) => f.userId === buyerId && f.vehicleId === x.id))
    const { user, router } = renderApp(`/vehicle/${v.slug}`)
    await screen.findByRole('heading', { name: /specifications/i }, T)
    await user.click(screen.getAllByRole('button', { name: /save this car/i })[0])
    const dialog = await screen.findByRole('dialog', { name: /sign in to continue/i }, T)
    await user.type(within(dialog).getByLabelText(/email address/i), 'buyer@example.com')
    await user.type(within(dialog).getByLabelText(/^password/i), 'Password123!')
    await user.click(within(dialog).getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/saved to your list/i, {}, T)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/vehicle/${v.slug}`)
    await waitFor(() => expect(server.db.favourites.some((f) => f.vehicleId === v.id)).toBe(true))
  })

  it('redirects protected routes to login with a return path', async () => {
    const { router } = renderApp('/dashboard')
    expect(await screen.findByRole('heading', { name: /welcome back/i }, T)).toBeInTheDocument()
    expect(router.state.location.search).toContain('next=%2Fdashboard')
  })

  it('buyer can message a seller with a conversation starter', async () => {
    await signInAs('buyer@example.com')
    const v = firstPublished((x) => x.contact.inApp && x.sellerType === 'DEALER')
    const { user } = renderApp(`/vehicle/${v.slug}`)
    await screen.findByRole('heading', { name: /specifications/i }, T)
    await user.click(screen.getAllByRole('button', { name: /message seller/i })[0])
    const dialog = await screen.findByRole('dialog', { name: /message the seller/i }, T)
    await user.click(within(dialog).getByRole('button', { name: /is the price negotiable/i }))
    await user.click(within(dialog).getByRole('button', { name: /send message/i }))
    expect(await screen.findByText(/message sent/i, {}, T)).toBeInTheDocument()
    expect(server.db.messages.some((m) => m.body === 'Is the price negotiable?')).toBe(true)
  })

  it('seller sees their listings dashboard', async () => {
    await signInAs('wanjiku@example.com')
    renderApp('/dashboard/listings')
    expect(await screen.findByRole('heading', { name: /my listings/i }, T)).toBeInTheDocument()
    expect((await screen.findAllByText(/Toyota Axio/i, {}, T)).length).toBeGreaterThan(0)
  })

  it('listing wizard validates each step with the shared schema', async () => {
    await signInAs('wanjiku@example.com')
    localStorage.clear()
    await signInAs('wanjiku@example.com')
    const { user } = renderApp('/sell/vehicle')
    expect(await screen.findByRole('heading', { name: /seller type/i }, T)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByRole('heading', { name: /vehicle basics/i }, T)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText('Select a make', {}, T)).toBeInTheDocument()
  })

  it('non-admins cannot open the admin area; admins can', async () => {
    await signInAs('buyer@example.com')
    const first = renderApp('/admin')
    expect(await screen.findByText(/you don’t have access/i, {}, T)).toBeInTheDocument()
    first.unmount()
    await signInAs('admin@garinice.co.ke')
    renderApp('/admin')
    expect(await screen.findByRole('heading', { level: 1, name: /overview/i }, T)).toBeInTheDocument()
    expect(await screen.findByText(/pending approvals/i, {}, T)).toBeInTheDocument()
  })
})

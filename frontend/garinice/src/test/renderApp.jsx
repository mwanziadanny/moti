import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { api } from '../api'
import { setToken } from '../api/client'
import { routes } from '../app/routes'
import { ToastProvider } from '../components/ui/Toast'
import { AuthProvider } from '../hooks/useAuth'

export function renderApp(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { ...utils, router, user, queryClient }
}

export async function signInAs(email, password = 'Password123!') {
  const res = await api.auth.login({ email, password })
  setToken(res.token)
  return res.user
}

export function signOut() {
  setToken(null)
}

import { Suspense, useEffect } from 'react'
import { isRouteErrorResponse, Outlet, ScrollRestoration, useRouteError } from 'react-router-dom'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SiteHeader } from '../components/layout/SiteHeader'
import { Button } from '../components/ui/Button'
import { ErrorState } from '../components/ui/Feedback'
import { AuthPrompt } from '../features/auth/AuthPrompt'
import { FullPageSpinner } from '../features/auth/Guards'

export function RouteError() {
  const error = useRouteError()
  const chunkFailed = /Failed to fetch dynamically imported module|Importing a module script failed/i.test(error?.message || '')
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="container-page py-20">
      <ErrorState
        error={chunkFailed ? { message: 'A new version of GariNice is available. Reload the page to continue.' } : isRouteErrorResponse(error) ? { message: error.statusText } : { message: 'An unexpected error occurred. Our team has been notified.' }}
        title={chunkFailed ? 'Update available' : 'Something went wrong'}
        onRetry={() => window.location.reload()}
      />
      <div className="mt-6 text-center"><Button variant="secondary" href="/">Back to homepage</Button></div>
    </div>
  )
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Suspense fallback={<FullPageSpinner />}><Outlet /></Suspense>
      </main>
      <SiteFooter />
      <AuthPrompt />
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  )
}

export function BareLayout() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Outlet />
      <ScrollRestoration />
    </Suspense>
  )
}

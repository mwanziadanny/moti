import { ShieldAlert } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Feedback'
import { useAuth } from '../../hooks/useAuth'

export function FullPageSpinner() {
  return <div className="grid min-h-[50vh] place-items-center text-teal-600"><Spinner className="size-8" /></div>
}

/** Client-side guard for UX only — every API endpoint enforces auth/roles server-side. */
export function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <ShieldAlert className="size-12 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">You don’t have access to this page</h1>
        <p className="mt-2 max-w-md text-muted">This area is restricted. If you believe you should have access, contact your administrator.</p>
        <Button className="mt-6" to="/">Go to homepage</Button>
      </div>
    )
  }
  return children ?? <Outlet />
}

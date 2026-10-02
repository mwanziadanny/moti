import { Heart } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../../components/ui/Overlay'
import { LoginForm } from './LoginForm'

/** Sign-in prompt shown in place, so the user never loses the page they were on. */
export function AuthPrompt() {
  const { prompt, closePrompt } = useAuth()
  const { pathname, search } = useLocation()
  const next = encodeURIComponent(pathname + search)
  return (
    <Modal open={!!prompt} onClose={closePrompt} title="Sign in to continue" size="sm">
      <div className="mb-5 flex items-start gap-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
        <Heart className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{prompt?.reason}</p>
      </div>
      <LoginForm compact />
      <p className="mt-5 text-center text-sm text-muted">
        New to GariNice?{' '}
        <Link to={`/register?next=${next}`} onClick={closePrompt} className="font-semibold text-teal-700 hover:underline">Create a free account</Link>
      </p>
    </Modal>
  )
}

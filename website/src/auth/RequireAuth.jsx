import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Sends a signed-out visitor to sign-in and back here afterwards. */
export default function RequireAuth({ children }) {
  const { session, ready } = useAuth()
  const { pathname, search } = useLocation()
  if (!ready) return <div className="page container section" aria-busy="true" />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  return children
}

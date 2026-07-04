import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

export default function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid var(--fho-orange-1, #FF6B00)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/profile" replace state={{ intent: 'signin', from: location.pathname }} />
  }

  if (requireRole && profile?.role !== requireRole) {
    return <Navigate to="/" replace />
  }

  return children
}

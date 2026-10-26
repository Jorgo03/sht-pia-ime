import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

function Spinner({ children }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
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
      {children}
    </div>
  )
}

export default function ProtectedRoute({ children, requireRole }) {
  const { t } = useTranslation()
  const { user, profile, loading, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />

  if (!user) {
    return <Navigate to="/profile" replace state={{ intent: 'signin', from: location.pathname }} />
  }

  // Signed in, but the profile (and so the role) has not arrived: it is
  // fetched with a time limit and can land late, or fail on a bad network.
  // "Not loaded" used to count as "not an agent" and sent real agents home.
  if (requireRole && !profile) {
    return (
      <Spinner>
        <button type="button" className="pill-btn" onClick={() => refreshProfile()}>{t('common.retry')}</button>
      </Spinner>
    )
  }

  if (requireRole && profile.role !== requireRole) {
    return <Navigate to="/" replace />
  }

  return children
}

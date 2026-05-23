import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { User, Briefcase } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import '../styles/profile.css'

const SOCIAL_PROVIDERS = [
  {
    provider: 'google',
    labelKey: 'auth.continueWithGoogle',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  // Re-enable later:
  // {
  //   provider: 'apple',
  //   labelKey: 'auth.continueWithApple',
  //   icon: ( <svg>...</svg> ),
  // },
  // {
  //   provider: 'azure',
  //   labelKey: 'auth.continueWithMicrosoft',
  //   icon: ( <svg>...</svg> ),
  // },
  // {
  //   provider: 'linkedin_oidc',
  //   labelKey: 'auth.continueWithLinkedIn',
  //   icon: ( <svg>...</svg> ),
  // },
]

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signIn, signUp, signInWithProvider, signOut, resetPassword, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState('buyer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    if (!email || !password) {
      setMessage(t('errors.fillFields'))
      return
    }
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await signUp(email, password, {
        role,
        full_name: fullName || undefined,
        agency_name: role === 'agent' ? agencyName || undefined : undefined,
      })
      setLoading(false)
      if (error) {
        setMessage(error.message)
      } else {
        setMessage(t('auth.checkEmail'))
      }
    } else {
      const { error } = await signIn(email, password)
      setLoading(false)
      if (error) {
        setMessage(error.message)
      } else {
        navigate('/')
      }
    }
  }

  const handleSocialLogin = async (provider) => {
    setMessage('')
    const { error } = await signInWithProvider(provider, role)
    if (error) {
      setMessage(error.message)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage(t('auth.email'))
      return
    }
    setMessage('')
    const { error } = await resetPassword(email)
    if (error) {
      setMessage(error.message)
    } else {
      setMessage(t('auth.resetSent'))
    }
  }

  if (authLoading) return null

  if (user) {
    const isAgent = user.user_metadata?.role === 'agent'
    return (
      <div className="page profile-page">
        <h1 className="page-title">{t('common.profile')}</h1>
        <div className="profile-card">
          <div className="profile-avatar">
            {(user.user_metadata?.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="profile-email">{user.email}</div>
          {user.user_metadata?.full_name && (
            <div className="profile-name">{user.user_metadata.full_name}</div>
          )}
          <div className="profile-role-badge">
            {isAgent ? t('auth.agent') : t('auth.user')}
          </div>
          <p className="profile-welcome">{t('auth.welcome')}</p>
          {isAgent && (
            <button className="btn btn-primary" onClick={() => navigate('/agent-dashboard')}>
              {t('agentDashboard.title')}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => signOut()}>
            {t('common.signOut')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page profile-page">
      <h1 className="page-title">{t('common.profile')}</h1>
      <div className="auth-card">
        <div className="role-toggle">
          <button
            className={`role-btn ${role === 'buyer' ? 'active' : ''}`}
            onClick={() => setRole('buyer')}
          >
            <User size={16} />
            {t('auth.roleClient')}
          </button>
          <button
            className={`role-btn ${role === 'agent' ? 'active' : ''}`}
            onClick={() => setRole('agent')}
          >
            <Briefcase size={16} />
            {t('auth.roleAgent')}
          </button>
        </div>

        <h2 className="auth-title">
          {isSignUp ? t('auth.createAccount') : t('auth.signInTitle')}
        </h2>
        <p className="auth-subtitle">
          {role === 'agent' ? t('auth.agentSubtitle') : t('auth.clientSubtitle')}
        </p>

        <div className="social-buttons">
          {SOCIAL_PROVIDERS.map(sp => (
            <button
              key={sp.provider}
              className="social-btn"
              onClick={() => handleSocialLogin(sp.provider)}
            >
              <span className="social-icon">{sp.icon}</span>
              <span>{t(sp.labelKey)}</span>
            </button>
          ))}
        </div>

        <div className="divider">
          <span>{t('auth.signInWith')}</span>
        </div>

        {isSignUp && (
          <input
            type="text"
            className="form-input"
            placeholder={t('auth.fullName')}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            autoComplete="name"
          />
        )}

        <input
          type="email"
          className="form-input"
          placeholder={t('auth.email')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          type="password"
          className="form-input"
          placeholder={t('auth.password')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        {isSignUp && role === 'agent' && (
          <input
            type="text"
            className="form-input"
            placeholder={t('auth.agencyName')}
            value={agencyName}
            onChange={e => setAgencyName(e.target.value)}
            autoComplete="organization"
          />
        )}

        <button className="btn btn-primary" onClick={handleAuth} disabled={loading}>
          {loading ? t('common.loading') : isSignUp ? t('common.signUp') : t('common.signIn')}
        </button>

        {!isSignUp && (
          <button className="link-btn" onClick={handleForgotPassword}>
            {t('auth.forgotPassword')}
          </button>
        )}

        {message && <div className="auth-message">{message}</div>}

        <button className="link-btn" onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}>
          {isSignUp ? (
            <>{t('auth.hasAccount')} <strong>{t('common.signIn')}</strong></>
          ) : (
            <>{t('auth.noAccount')} <strong>{t('common.signUp')}</strong></>
          )}
        </button>
      </div>
    </div>
  )
}

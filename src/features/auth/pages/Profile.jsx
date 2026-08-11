import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, Briefcase, Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Heart, Building2, LogOut, ChevronRight, Search as SearchIcon, Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useProfileStats } from '../hooks/useProfileStats'
import DuskHero from '../components/DuskHero'
import '../../../styles/profile.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function friendlyError(err, t) {
  if (!err?.message) return t('errors.generic')
  if (err.code === 'email_address_invalid') return t('errors.invalidEmail')
  const map = {
    'Invalid login credentials': 'errors.invalidCredentials',
    'User already registered': 'errors.userExists',
    'Email not confirmed': 'errors.emailNotConfirmed',
    'Token has expired or is invalid': 'errors.invalidCode',
    'is invalid': 'errors.invalidEmail',
    'For security purposes, you can only request this after': 'errors.rateLimited',
    'provider is not enabled': 'errors.providerNotConfigured',
    'Unsupported provider': 'errors.providerNotConfigured',
  }
  const key = Object.keys(map).find((k) => err.message.includes(k))
  return key ? t(map[key]) : t('errors.generic')
}

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, isAgent, signIn, signUp, signInWithProvider, sendOtp, verifyOtp, resendCode, signOut, resetPassword, loading: authLoading } = useAuth()
  const stats = useProfileStats()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [fullName, setFullName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState('buyer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  // 'google' | 'apple' | 'linkedin_oidc' while the OAuth redirect is starting
  const [providerLoading, setProviderLoading] = useState(null)
  const oauthErrorShown = useRef(false)

  // AuthCallback lands here with ?error=oauth_failed when a provider
  // redirect comes back without a session (denied, malformed, misconfigured).
  useEffect(() => {
    if (oauthErrorShown.current) return
    const params = new URLSearchParams(location.search)
    if (params.get('error') === 'oauth_failed') {
      oauthErrorShown.current = true
      setMessage(t('errors.oauthFailed'))
      navigate('/profile', { replace: true })
    }
  }, [location.search, navigate, t])

  const [otpStep, setOtpStep] = useState(null)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  // 'email' = code from the Email-Code flow; 'signup' = confirmation code
  // after a password signup. verifyOtp/resend must match the origin.
  const [otpType, setOtpType] = useState('email')
  const [otpError, setOtpError] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const otpRefs = useRef([])

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => (s > 1 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [cooldown > 0])

  const validate = () => {
    if (!EMAIL_RE.test(email)) {
      setMessage(t('errors.invalidEmail'))
      return false
    }
    if (password.length < 8) {
      setMessage(t('errors.passwordMin'))
      return false
    }
    if (isSignUp && fullName.trim().length < 2) {
      setMessage(t('errors.nameRequired'))
      return false
    }
    return true
  }

  const handleAuth = async () => {
    setMessage('')
    if (!validate()) return
    setLoading(true)
    if (isSignUp) {
      const { error } = await signUp(email, password, {
        role,
        full_name: fullName.trim(),
        agency_name: role === 'agent' ? agencyName.trim() || undefined : undefined,
      })
      setLoading(false)
      if (error) setMessage(friendlyError(error, t))
      else {
        // Confirmation email carries a 6-digit code — take the user straight
        // to the code entry (type 'signup' so verify/resend match).
        setOtpEmail(email)
        setOtpType('signup')
        setOtpCode(['', '', '', '', '', ''])
        setOtpError(false)
        setOtpStep('enter-code')
        setCooldown(30)
        setMessage(t('auth.checkEmail'))
      }
    } else {
      const { error } = await signIn(email, password)
      setLoading(false)
      if (error) {
        setMessage(friendlyError(error, t))
      } else {
        const from = location.state?.from || '/'
        navigate(from, { replace: true })
      }
    }
  }

  const handleProvider = async (provider) => {
    if (providerLoading) return
    setMessage('')
    setProviderLoading(provider)
    // The role toggle can't ride through the provider redirect (OAuth
    // signups carry no role metadata, so the DB trigger defaults to
    // client). Stash it; AuthContext applies it after the callback, and
    // only to a freshly created account — existing profiles are never
    // rewritten by signing in again.
    try { localStorage.setItem('fho_pending_role', role) } catch { /* storage blocked — role stays client */ }
    const { error } = await signInWithProvider(provider)
    if (error) {
      setProviderLoading(null)
      setMessage(friendlyError(error, t))
    }
    // On success the browser is navigating to the provider — keep the
    // buttons disabled so a double-click can't fire a second redirect.
  }

  const handleGoogleOtp = () => {
    setOtpStep('enter-email')
    setOtpEmail('')
    setOtpCode(['', '', '', '', '', ''])
    setOtpType('email')
    setOtpError(false)
    setMessage('')
  }

  const handleSendOtp = async () => {
    // Same validity check the password form uses. A presence-only guard let
    // malformed addresses reach Supabase, which rejects them with a raw
    // "Unable to validate email address: invalid format" 400.
    if (!EMAIL_RE.test(otpEmail)) { setMessage(t('errors.invalidEmail')); return }
    // OTP signups carry no role metadata either — same stash-and-apply
    // path as OAuth, and overwriting here means an aborted OAuth click
    // can't leak its role choice into this flow.
    try { localStorage.setItem('fho_pending_role', role) } catch { /* ignore */ }
    setLoading(true); setMessage('')
    const { error } = await sendOtp(otpEmail)
    setLoading(false)
    if (error) setMessage(friendlyError(error, t))
    else { setOtpStep('enter-code'); setOtpError(false); setCooldown(30); setMessage(t('auth.otpSent')) }
  }

  const handleResend = async () => {
    if (cooldown > 0 || loading) return
    // Guarded too: otpEmail is cleared when the component remounts after a
    // magic-link login, and resending with an empty address 400s.
    if (!EMAIL_RE.test(otpEmail)) { setMessage(t('errors.invalidEmail')); return }
    setLoading(true); setMessage(''); setOtpError(false)
    const { error } = await resendCode(otpEmail, otpType)
    setLoading(false)
    if (error) setMessage(friendlyError(error, t))
    else { setCooldown(30); setMessage(t('auth.otpSent')) }
  }

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1)
    if (value && !/^\d$/.test(value)) return
    setOtpError(false)
    const newCode = [...otpCode]
    newCode[index] = value
    setOtpCode(newCode)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
    if (newCode.every((d) => d !== '')) handleVerifyOtp(newCode.join(''))
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newCode = [...otpCode]
    for (let i = 0; i < 6; i++) newCode[i] = pasted[i] || ''
    setOtpCode(newCode)
    if (pasted.length === 6) handleVerifyOtp(pasted)
    else otpRefs.current[pasted.length]?.focus()
  }

  const handleVerifyOtp = async (code) => {
    setLoading(true); setMessage('')
    const { error } = await verifyOtp(otpEmail, code, otpType)
    setLoading(false)
    if (error) {
      setOtpError(true)
      setMessage(friendlyError(error, t))
      setOtpCode(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } else {
      setOtpStep(null)
      navigate('/')
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setMessage(t('auth.enterEmail')); return }
    setMessage('')
    const { error } = await resetPassword(email)
    setMessage(error ? friendlyError(error, t) : t('auth.resetSent'))
  }

  if (authLoading) return null

  // ─── Signed-in dashboard ───
  if (user) {
    const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '?'
    const initial = displayName[0]?.toUpperCase() || '?'

    const settingsRows = [
      { icon: Heart, label: t('favourites.title'), to: '/favorites', badge: stats.saved || null },
      { icon: SearchIcon, label: t('profile.savedSearches'), to: '/saved-searches', badge: stats.searches || null },
      { icon: Calendar, label: t('viewings.title'), to: '/viewings' },
      { icon: Building2, label: t('listing.myListings'), to: '/my-listings' },
      ...(isAgent ? [{ icon: Briefcase, label: t('agentDashboard.title'), to: '/agent-dashboard' }] : []),
    ]

    return (
      <div className="page profile-page">
        <div className="profile-card">
          <div className="profile-avatar">{initial}</div>
          <div className="profile-name">{displayName}</div>
          <div className="profile-role-badge">{isAgent ? t('auth.agent') : t('auth.user')}</div>
          <div className="profile-email-row">{user.email}</div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat__val">{stats.loading ? '–' : stats.saved}</span>
            <span className="profile-stat__label">{t('profile.statSaved')}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__val">{stats.loading ? '–' : stats.searches}</span>
            <span className="profile-stat__label">{t('profile.statSearches')}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__val">{stats.loading ? '–' : stats.third}</span>
            <span className="profile-stat__label">{isAgent ? t('profile.statListings') : t('profile.statViewings')}</span>
          </div>
        </div>

        <div className="profile-settings">
          {settingsRows.map((row, i) => {
            const Icon = row.icon
            return (
              <button key={i} className="profile-row" onClick={() => row.to && navigate(row.to)}>
                <Icon size={20} />
                <span>{row.label}</span>
                {row.badge ? <span className="profile-row__badge">{row.badge}</span> : null}
                <ChevronRight size={16} className="profile-row__chevron" />
              </button>
            )
          })}
        </div>

        <button className="profile-signout" onClick={() => signOut().then(() => navigate('/profile'))}>
          <LogOut size={18} />
          {t('common.signOut')}
        </button>
      </div>
    )
  }

  // ─── OTP: enter email ───
  if (otpStep === 'enter-email') {
    return (
      <div className="profile-page auth-screen">
        <DuskHero />
        <div className="auth-content">
          <div className="auth-glass">
            <button className="link-btn otp-back" onClick={() => setOtpStep(null)}><ArrowLeft size={16} /> {t('common.back')}</button>
            <div className="otp-icon"><Mail size={32} /></div>
            <h2 className="auth-title">{t('auth.otpTitle')}</h2>
            <p className="auth-subtitle">{t('auth.otpSubtitle')}</p>
            <div className="field-row"><Mail size={18} className="field-icon" /><input type="email" className="form-input" placeholder={t('auth.email')} value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()} /></div>
            <button className="cta-pill" onClick={handleSendOtp} disabled={loading}>{loading ? t('common.loading') : t('auth.sendCode')}</button>
            {message && <div className="auth-message">{message}</div>}
          </div>
        </div>
      </div>
    )
  }

  // ─── OTP: enter code ───
  if (otpStep === 'enter-code') {
    return (
      <div className="profile-page auth-screen">
        <DuskHero />
        <div className="auth-content">
          <div className="auth-glass">
            <button className="link-btn otp-back" onClick={() => setOtpStep(otpType === 'signup' ? null : 'enter-email')}><ArrowLeft size={16} /> {t('common.back')}</button>
            <div className="otp-icon"><Mail size={32} /></div>
            <h2 className="auth-title">{t('auth.enterCode')}</h2>
            <p className="auth-subtitle">{t('auth.codeSentTo', { email: otpEmail })}</p>
            <div className="otp-inputs" onPaste={handleOtpPaste}>
              {otpCode.map((digit, i) => (
                <input key={i} ref={(el) => (otpRefs.current[i] = el)} type="text" inputMode="numeric" maxLength={1} className={`otp-digit ${digit ? 'filled' : ''} ${otpError ? 'error' : ''}`} value={digit} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)} autoFocus={i === 0} />
              ))}
            </div>
            {loading && <p className="auth-subtitle">{t('common.loading')}</p>}
            <button className="link-btn" onClick={handleResend} disabled={loading || cooldown > 0}>
              {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resendCode')}
            </button>
            {message && <div className={`auth-message ${otpError ? 'auth-message--error' : ''}`} role={otpError ? 'alert' : 'status'}>{message}</div>}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main auth form ───
  return (
    <div className="profile-page auth-screen">
      <DuskHero />
      <div className="auth-content">
        <div className="auth-headline-block" style={{ animationDelay: '150ms' }}>
          <div className="screen-kicker"><span className="screen-kicker__dash" />{isSignUp ? t('auth.kickerSignUp') : t('auth.kickerSignIn')}</div>
          <h1 className="screen-headline auth-hero-headline">
            {isSignUp
              ? (<>{t('auth.heroSignUpPre')} <em>{t('auth.heroSignUpEm')}</em> {t('auth.heroSignUpPost')}</>)
              : (<>{t('auth.heroSignInPre')} <em>{t('auth.heroSignInEm')}</em> {t('auth.heroSignInPost')}</>)}
          </h1>
        </div>
        <div className="auth-glass">
          <div className="role-toggle">
            <button className={`role-btn ${role === 'buyer' ? 'active' : ''}`} onClick={() => setRole('buyer')}><User size={16} /> {t('auth.roleClient')}</button>
            <button className={`role-btn ${role === 'agent' ? 'active' : ''}`} onClick={() => setRole('agent')}><Briefcase size={16} /> {t('auth.roleAgent')}</button>
          </div>

          {isSignUp && (
            <div className="field-row"><User size={18} className="field-icon" /><input type="text" className="form-input" placeholder={t('auth.fullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          )}

          <div className="field-row"><Mail size={18} className="field-icon" /><input type="email" className="form-input" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} /></div>

          <div className="field-row">
            <Lock size={18} className="field-icon" />
            <input type={showPw ? 'text' : 'password'} className="form-input" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAuth()} />
            <button className="field-eye" onClick={() => setShowPw(!showPw)} type="button">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>

          {isSignUp && role === 'agent' && (
            <div className="field-row"><Building2 size={18} className="field-icon" /><input type="text" className="form-input" placeholder={t('auth.agencyName')} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} /></div>
          )}

          <button className="cta-pill" onClick={handleAuth} disabled={loading}>
            {loading ? t('common.loading') : isSignUp ? t('common.signUp') : t('common.signIn')}
            <ArrowRight size={18} />
          </button>

          {!isSignUp && <button className="link-btn" onClick={handleForgotPassword}>{t('auth.forgotPassword')}</button>}

          {message && <div className="auth-message">{message}</div>}

          <div className="divider"><span>{t('auth.signInWith')}</span></div>

          <div className="social-buttons">
            <button className="social-btn" onClick={() => handleProvider('google')} disabled={!!providerLoading}>
              {providerLoading === 'google' ? <Loader2 size={18} className="animate-spin" /> : (
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              )}
              {t('auth.continueWithGoogle')}
            </button>
            {/* Apple + LinkedIn removed until the providers are enabled in the
                Supabase dashboard (DECISIONS.md P2-G) — signInWithProvider and
                the callback already support them, so re-adding is just the
                buttons: handleProvider('apple') / handleProvider('linkedin_oidc'). */}
            <button className="social-btn" onClick={handleGoogleOtp} disabled={!!providerLoading}>
              <Mail size={18} />
              {t('auth.signInWithEmail')}
            </button>
          </div>

          <button className="link-btn" onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}>
            {isSignUp ? (<>{t('auth.hasAccount')} <strong>{t('common.signIn')}</strong></>) : (<>{t('auth.noAccount')} <strong>{t('common.signUp')}</strong></>)}
          </button>
        </div>
      </div>
    </div>
  )
}

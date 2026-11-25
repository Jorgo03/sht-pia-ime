import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EMAIL_RE, friendlyError } from '@/src/lib/authErrors.js'
import { providerEnabled } from '@/src/features/auth/lib/authLinks.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import AuthLayout from '../auth/AuthLayout'
import { CodeStep, FormError, GoogleButton, PasswordField, TextField } from '../auth/Fields'

/** Only an in-site path is followed after sign-in, never another site. */
export function safeNext(params) {
  const next = params.get('next') ?? ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

/** Whether Google sign-in is switched on in Supabase (null while unknown). */
export function useGoogleEnabled() {
  const [on, setOn] = useState(null)
  useEffect(() => {
    let alive = true
    providerEnabled(supabase, 'google').then((v) => alive && setOn(v !== false))
    return () => {
      alive = false
    }
  }, [])
  return on
}

export default function Login() {
  const { t } = useTranslation()
  const { session, ready, signIn, verifyCode, resendSignupCode, signInWithGoogle } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params)
  const google = useGoogleEnabled()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  if (ready && session) return <Navigate to={next} replace />

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const clean = email.trim()
    if (!EMAIL_RE.test(clean)) return setError(t('errors.invalidEmail'))
    if (!password) return setError(t('errors.passwordRequired'))
    setBusy(true)
    setError(null)
    const { error: err } = await signIn(clean, password)
    setBusy(false)
    if (err?.code === 'email_not_confirmed') return setConfirming(true)
    if (err) return setError(friendlyError(err, t))
    navigate(next, { replace: true })
  }

  const google_ = async () => {
    setError(null)
    const { error: err } = await signInWithGoogle()
    if (err) setError(friendlyError(err, t))
  }

  if (confirming) {
    return (
      <AuthLayout title={t('auth.verifyEmailTitle')} lead={t('auth.confirmFirst')}>
        <CodeStep
          email={email.trim()}
          freshCode={false}
          onVerify={(code) => verifyCode(email.trim(), code, 'signup')}
          onResend={() => resendSignupCode(email.trim())}
          onBack={() => setConfirming(false)}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.signInTitle')} lead={t('web.auth.signInLead')}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <PasswordField label={t('auth.password')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Link to="/forgot-password" className="text-link small">
          {t('auth.forgotShort')}
        </Link>
        <FormError>{error}</FormError>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {t('common.signIn')}
        </button>
      </form>
      {google && (
        <>
          <p className="divider">
            <span>{t('common.or')}</span>
          </p>
          <GoogleButton onClick={google_} />
        </>
      )}
      <p className="auth-switch">
        {t('auth.noAccount')}{' '}
        <Link to={`/signup${params.size ? `?${params}` : ''}`} className="text-link">
          {t('auth.createAccount')}
        </Link>
      </p>
    </AuthLayout>
  )
}

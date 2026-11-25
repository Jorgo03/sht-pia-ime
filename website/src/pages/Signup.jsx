import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Home, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EMAIL_RE, friendlyError } from '@/src/lib/authErrors.js'
import { passwordStrengthError } from '@/src/features/auth/lib/password.js'
import { PROFILE_LIMITS } from '@/src/features/auth/lib/profileForm.js'
import { ACCOUNT_TYPES, useAuth } from '../auth/AuthContext'
import AuthLayout from '../auth/AuthLayout'
import { CodeStep, FormError, GoogleButton, PasswordField, TextField } from '../auth/Fields'
import { safeNext, useGoogleEnabled } from './Login'

const ICONS = { client: Home, agent: UserRound, office: Building2 }

export default function Signup() {
  const { t, i18n } = useTranslation()
  const { session, ready, signUp, verifyCode, resendSignupCode, signInWithGoogle } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params)
  const google = useGoogleEnabled()
  const [type, setType] = useState(() => (ACCOUNT_TYPES.includes(params.get('type')) ? params.get('type') : 'client'))
  const [fullName, setFullName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [existing, setExisting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (ready && session && !confirming) return <Navigate to={next} replace />

  const validate = () => {
    if (fullName.trim().length < 2) return 'errors.nameRequired'
    if (type === 'office' && !agencyName.trim()) return 'web.auth.officeRequired'
    if (!EMAIL_RE.test(email.trim())) return 'errors.invalidEmail'
    return passwordStrengthError(password)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const problem = validate()
    setExisting(false)
    if (problem) return setError(t(problem))
    setBusy(true)
    setError(null)
    const { error: err, needsConfirmation } = await signUp({
      email: email.trim(),
      password,
      type,
      fullName: fullName.trim(),
      agencyName: type === 'client' ? undefined : agencyName.trim(),
      language: i18n.resolvedLanguage,
    })
    setBusy(false)
    if (err) {
      setExisting(err.code === 'user_already_exists' || err.code === 'email_exists')
      return setError(friendlyError(err, t))
    }
    if (needsConfirmation) return setConfirming(true)
    navigate(next, { replace: true })
  }

  if (confirming) {
    return (
      <AuthLayout title={t('auth.verifyEmailTitle')} lead={t('auth.verifyEmailSubtitle')}>
        <CodeStep
          email={email.trim()}
          onVerify={async (code) => {
            const res = await verifyCode(email.trim(), code, 'signup')
            if (!res.error) navigate(next, { replace: true })
            return res
          }}
          onResend={() => resendSignupCode(email.trim())}
          onBack={() => navigate('/login', { replace: true })}
        >
          <p className="field-hint">{t('auth.signupCodeHint')}</p>
        </CodeStep>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.createAccount')} lead={t('web.auth.signUpLead')}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <fieldset className="types">
          <legend>{t('web.auth.accountType')}</legend>
          {ACCOUNT_TYPES.map((value) => {
            const Icon = ICONS[value]
            return (
              <label key={value} className={`type ${type === value ? 'is-on' : ''}`}>
                <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} />
                <Icon size={20} aria-hidden="true" />
                <span className="type-name">{t(`web.auth.type.${value}`)}</span>
                <span className="type-hint">{t(`web.auth.typeHint.${value}`)}</span>
              </label>
            )
          })}
        </fieldset>
        <TextField label={t('auth.fullName')} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={PROFILE_LIMITS.full_name} required />
        {type !== 'client' && (
          <TextField
            label={type === 'office' ? t('auth.officeName') : t('web.auth.agencyOptional')}
            autoComplete="organization"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            maxLength={PROFILE_LIMITS.agency_name}
            required={type === 'office'}
            hint={type === 'office' ? t('web.auth.officeHint') : undefined}
          />
        )}
        <TextField label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField label={t('auth.password')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} showRules required />
        <FormError>{error}</FormError>
        {existing && (
          <p className="form-note">
            {t('auth.existingAccountHint')}{' '}
            <Link to="/login" className="text-link">
              {t('auth.signInThisEmail')}
            </Link>
          </p>
        )}
        <p className="field-hint">
          {t('web.auth.agree')} <a href="/terms">{t('legal.termsOfService')}</a> · <a href="/privacy">{t('legal.privacyPolicy')}</a>
        </p>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {t('auth.createAccount')}
        </button>
      </form>
      {google && type === 'client' && (
        <>
          <p className="divider">
            <span>{t('common.or')}</span>
          </p>
          <GoogleButton onClick={() => signInWithGoogle()} />
        </>
      )}
      <p className="auth-switch">
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="text-link">
          {t('common.signIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}

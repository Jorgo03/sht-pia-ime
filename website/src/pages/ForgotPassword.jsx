import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EMAIL_RE, friendlyError } from '@/src/lib/authErrors.js'
import { passwordStrengthError } from '@/src/features/auth/lib/password.js'
import { useAuth } from '../auth/AuthContext'
import AuthLayout from '../auth/AuthLayout'
import { CodeStep, FormError, PasswordField, TextField } from '../auth/Fields'

// Reset by emailed code, like the phone app: the code opens a recovery
// session, then the new password is saved on it. No link has to come back to
// this site, so it works whatever redirect addresses Supabase allows.
export default function ForgotPassword() {
  const { t } = useTranslation()
  const { sendResetCode, verifyCode, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const send = async (e) => {
    e?.preventDefault()
    if (busy) return
    if (!EMAIL_RE.test(email.trim())) return setError(t('errors.invalidEmail'))
    setBusy(true)
    setError(null)
    const { error: err } = await sendResetCode(email.trim())
    setBusy(false)
    if (err) return setError(friendlyError(err, t))
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title={t('auth.recoveryTitle')} lead={t('auth.resetCodeSent', { email: email.trim() })}>
        <CodeStep
          email={email.trim()}
          onVerify={async (code) => {
            const weak = passwordStrengthError(password)
            if (weak) return { error: { message: t(weak), local: true } }
            const res = await verifyCode(email.trim(), code, 'recovery')
            if (res.error) return res
            const saved = await updatePassword(password)
            if (saved.error) return saved
            navigate('/account', { replace: true, state: { notice: 'auth.recoverySuccess' } })
            return { error: null }
          }}
          onResend={() => sendResetCode(email.trim())}
          onBack={() => navigate('/login', { replace: true })}
        >
          <PasswordField label={t('auth.newPassword')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} showRules required />
        </CodeStep>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} lead={t('auth.forgotSubtitle')}>
      <form className="auth-form" onSubmit={send} noValidate>
        <TextField label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <FormError>{error}</FormError>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {t('auth.sendCode')}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login" className="text-link">
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}

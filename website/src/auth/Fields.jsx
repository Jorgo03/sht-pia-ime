import { useEffect, useId, useState } from 'react'
import { Check, Circle, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { passwordChecks } from '@/src/features/auth/lib/password.js'
import { blockedCodeKey, codeExpiry, formatCountdown, rejectedCodeKey, RESEND_WAIT_S, secondsLeft } from '@/src/features/auth/lib/signupCode.js'
import { friendlyError, retryAfterSeconds } from '@/src/lib/authErrors.js'

export function TextField({ label, hint, error, ...input }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  )
}

export function PasswordField({ label, showRules = false, value, ...input }) {
  const { t } = useTranslation()
  const id = useId()
  const [shown, setShown] = useState(false)
  const checks = passwordChecks(value)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password">
        <input id={id} type={shown ? 'text' : 'password'} value={value} aria-describedby={showRules ? `${id}-rules` : undefined} {...input} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={shown}>
          {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {showRules && (
        <ul id={`${id}-rules`} className="pw-rules" aria-label={t('auth.pwRules')}>
          {['length', 'upper', 'lower', 'digit', 'symbol'].map((rule) => (
            <li key={rule} className={checks[rule] ? 'is-met' : ''}>
              {checks[rule] ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              {t(`auth.pwRule.${rule}`)}
              <span className="visually-hidden">: {checks[rule] ? t('auth.pwRuleMet') : t('auth.pwRuleMissing')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p className="form-error" role="alert">
      {children}
    </p>
  )
}

/**
 * The 6-digit emailed code, used to confirm a new account. Supabase owns the
 * code; this only counts attempts and time so a dead code is never sent.
 * `onResend` returns { error } and is omitted when a new code cannot be asked for here.
 */
export function CodeStep({ email, onVerify, onResend, onBack, freshCode = true, children }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [expiresAt, setExpiresAt] = useState(() => (freshCode ? codeExpiry() : null))
  const [attempts, setAttempts] = useState(0)
  const [wait, setWait] = useState(freshCode ? RESEND_WAIT_S : 0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      setWait((w) => Math.max(0, w - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const left = secondsLeft(expiresAt, now)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const blocked = blockedCodeKey({ expiresAt, attempts })
    if (blocked) return setError(t(blocked))
    if (!/^\d{6}$/.test(code)) return setError(t('errors.invalidCode'))
    setBusy(true)
    setError(null)
    const { error: err } = await onVerify(code)
    setBusy(false)
    // A problem found before the code was sent (e.g. a weak new password)
    // is not a wrong code and does not count as an attempt.
    if (err?.local) return setError(err.message)
    if (err) {
      const next = attempts + 1
      setAttempts(next)
      const key = rejectedCodeKey(err, { expiresAt, attempts: next })
      setError(key ? t(key) : friendlyError(err, t))
    }
  }

  const resend = async () => {
    setError(null)
    const { error: err } = await onResend()
    if (err) {
      setWait(retryAfterSeconds(err) ?? 0)
      return setError(friendlyError(err, t))
    }
    setAttempts(0)
    setCode('')
    setExpiresAt(codeExpiry())
    setWait(RESEND_WAIT_S)
    setNotice(t('auth.newCodeSent'))
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <p className="auth-lead">{t('auth.codeSentTo', { email })}</p>
      <TextField
        label={t('auth.emailCode')}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        hint={left != null ? t('auth.codeExpiresIn', { time: formatCountdown(left) }) : t('auth.spamHint')}
      />
      {children}
      <FormError>{error}</FormError>
      {notice && !error && (
        <p className="form-note" role="status">
          {notice}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {t('auth.continue')}
      </button>
      <div className="auth-links">
        {onResend && (
          <button type="button" className="link-btn" onClick={resend} disabled={wait > 0}>
            {wait > 0 ? t('auth.resendIn', { s: wait }) : t('auth.resendCode')}
          </button>
        )}
        <button type="button" className="link-btn" onClick={onBack}>
          {t('auth.backToSignIn')}
        </button>
      </div>
    </form>
  )
}

export function GoogleButton({ onClick, disabled }) {
  const { t } = useTranslation()
  return (
    <button type="button" className="btn btn-outline btn-block google-btn" onClick={onClick} disabled={disabled}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {t('auth.continueWithGoogleFull')}
    </button>
  )
}

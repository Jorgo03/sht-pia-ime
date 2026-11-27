import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EMAIL_RE, friendlyError, retryAfterSeconds } from '@/src/lib/authErrors.js'
import { passwordChecks, passwordStrengthError } from '@/src/features/auth/lib/password.js'
import { PROFILE_LIMITS } from '@/src/features/auth/lib/profileForm.js'
import { providerEnabled } from '@/src/features/auth/lib/authLinks.js'
import { blockedCodeKey, codeExpiry, formatCountdown, rejectedCodeKey, RESEND_WAIT_S, secondsLeft } from '@/src/features/auth/lib/signupCode.js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { GoogleLogo, Icon, LinkedInLogo } from './icons'

// The website's sign-in, sign-up and password reset: the phone app's signed-out
// Profile screen (app/(tabs)/profile.tsx) drawn for the web — the dusk sky,
// the three-line headline, the glass card and every step in it, with the same
// rules and wording. Change the two together.

const OTP_LENGTH = 6
const RULES = ['length', 'upper', 'lower', 'digit', 'symbol']

/** Only an in-site path is followed after sign-in, never another site. */
function safeNext(params) {
  const next = params.get('next') ?? ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

/** Which of Google and LinkedIn Supabase has switched on (null while unknown). */
function useProviders() {
  const [on, setOn] = useState({ google: null, linkedin_oidc: null })
  useEffect(() => {
    let alive = true
    for (const p of ['google', 'linkedin_oidc']) {
      providerEnabled(supabase, p).then((v) => alive && setOn((prev) => ({ ...prev, [p]: v !== false })))
    }
    return () => {
      alive = false
    }
  }, [])
  return on
}

function DuskHero() {
  const buildings = [6, 8, 4, 6, 9]
  return (
    <div className="dusk-hero" aria-hidden="true">
      <div className="dusk-sky" />
      <div className="dusk-buildings">
        {buildings.map((wins, i) => (
          <div key={i} className={`building b${i + 1}`}>
            {Array.from({ length: wins }, (_, w) => (
              <div key={w} className="win" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ icon, label, children }) {
  return (
    <div className="a-field">
      <Icon name={icon} className="a-field-icon" />
      {children}
      <span className="visually-hidden">{label}</span>
    </div>
  )
}

function PasswordChecklist({ password }) {
  const { t } = useTranslation()
  const checks = passwordChecks(password)
  return (
    <ul className="a-checklist" aria-label={t('auth.pwRules')}>
      {RULES.map((rule) => (
        <li key={rule} className={checks[rule] ? 'is-met' : ''}>
          <Icon name={checks[rule] ? 'checkCircle' : 'radioUnchecked'} size={16} />
          {t(`auth.pwRule.${rule}`)}
          <span className="visually-hidden">: {checks[rule] ? t('auth.pwRuleMet') : t('auth.pwRuleMissing')}</span>
        </li>
      ))}
    </ul>
  )
}

/** Six boxes: typing moves on, Backspace goes back, a pasted code fills them all. */
function OtpInput({ value, onChange, onComplete, error, disabled }) {
  const { t } = useTranslation()
  const refs = useRef([])
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '')
  const handle = (i, raw) => {
    const typed = raw.replace(/\D/g, '')
    if (!typed) {
      const chars = [...digits]
      chars[i] = ''
      onChange(chars.join(''))
      return
    }
    const chars = [...digits]
    for (let k = 0; k < typed.length && i + k < OTP_LENGTH; k++) chars[i + k] = typed[k]
    const next = chars.join('')
    onChange(next)
    refs.current[Math.min(i + typed.length, OTP_LENGTH - 1)]?.focus()
    if (chars.every(Boolean)) onComplete?.(next)
  }
  return (
    <div className="a-otp">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className={`${d ? 'is-filled' : ''} ${error ? 'is-error' : ''}`}
          value={d}
          onChange={(e) => handle(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              const chars = [...digits]
              chars[i - 1] = ''
              onChange(chars.join(''))
              refs.current[i - 1]?.focus()
              e.preventDefault()
            }
          }}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={t('auth.codeDigit', { n: i + 1 })}
        />
      ))}
    </div>
  )
}

function Cta({ children, onClick, disabled, type = 'button', arrow = true }) {
  return (
    <button type={type} className="a-cta" onClick={onClick} disabled={disabled}>
      {children}
      {arrow && <Icon name="arrowForward" />}
    </button>
  )
}

export default function AuthScreen({ start = 'signin' }) {
  const { t, i18n } = useTranslation()
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params)
  const providers = useProviders()

  const [isSignUp, setIsSignUp] = useState(start === 'signup')
  const [role, setRole] = useState(params.get('role') === 'agent' ? 'agent' : 'buyer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useEmailCode, setUseEmailCode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState(null)
  const [existingAccount, setExistingAccount] = useState(false)
  const [wrongPassword, setWrongPassword] = useState(false)

  // The emailed-code step: 'signup' confirms a new account, 'email' signs in.
  const [otpType, setOtpType] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [notice, setNotice] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  // Password recovery: 'email' → 'code' → 'password'.
  const [recoveryStep, setRecoveryStep] = useState(start === 'recover' ? 'email' : null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [recovering, setRecovering] = useState(false)

  const emailFirst = useEmailCode && !isSignUp

  // The app's screen scrolls with its indicator hidden; the page does the same.
  useEffect(() => {
    document.documentElement.classList.add('no-scrollbar')
    return () => document.documentElement.classList.remove('no-scrollbar')
  }, [])

  useEffect(() => {
    document.title = `${isSignUp ? t('auth.createAccount') : t('auth.signInTitle')} | ${t('common.appName')}`
  }, [isSignUp, t])

  // One clock for the resend wait and the code's expiry, only while a code is out.
  useEffect(() => {
    if (!otpType && recoveryStep !== 'code') return
    const id = setInterval(() => {
      setNow(Date.now())
      setCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [otpType, recoveryStep])

  // Signed in: leave, unless the recovery code just signed the person in to
  // set a new password.
  if (auth.ready && auth.session && !recovering) return <Navigate to={next} replace />

  const clearErrors = () => {
    setFormError(null)
    setExistingAccount(false)
    setWrongPassword(false)
  }

  const switchMode = () => {
    const signUp = !isSignUp
    setIsSignUp(signUp)
    setUseEmailCode(false)
    clearErrors()
    window.history.replaceState(window.history.state, '', signUp ? '/signup' : '/login')
  }

  const openCodeStep = (type, wait, fresh) => {
    setOtpType(type)
    setOtpCode('')
    setOtpError(false)
    setAttempts(0)
    setNotice(null)
    setExpiresAt(fresh ? codeExpiry() : null)
    setCooldown(wait)
  }

  const validate = () => {
    if (!EMAIL_RE.test(email.trim())) return 'errors.invalidEmail'
    if (isSignUp) {
      const weak = passwordStrengthError(password)
      if (weak) return weak
      if (fullName.trim().length < 2) return 'errors.nameRequired'
      if (password !== confirmPassword) return 'errors.passwordMismatch'
      if (role === 'agent' && agencyName.trim().length < 2) return 'errors.officeRequired'
    } else if (!password) {
      return 'errors.passwordRequired'
    }
    return null
  }

  const handleAuth = async (e) => {
    e?.preventDefault()
    if (loading) return
    const problem = validate()
    clearErrors()
    if (problem) return setFormError(t(problem))
    const clean = email.trim()
    setEmail(clean)
    setLoading(true)
    if (isSignUp) {
      const { error, needsConfirmation } = await auth.signUp({
        email: clean,
        password,
        role,
        fullName: fullName.trim(),
        agencyName: agencyName.trim(),
        language: i18n.resolvedLanguage,
      })
      setLoading(false)
      if (error) {
        setExistingAccount(error.code === 'user_already_exists' || error.code === 'email_exists')
        return setFormError(friendlyError(error, t))
      }
      if (needsConfirmation) openCodeStep('signup', RESEND_WAIT_S, true)
      // Otherwise the account is signed in and the redirect above takes over.
    } else {
      const { error } = await auth.signIn(clean, password)
      setLoading(false)
      if (error?.code === 'email_not_confirmed') {
        openCodeStep('signup', 0, false)
        return setNotice({ text: t('auth.confirmFirst'), tone: 'info' })
      }
      if (error) {
        setWrongPassword(error.code === 'invalid_credentials')
        setFormError(friendlyError(error, t))
      }
    }
  }

  const handleSendOtp = async (e) => {
    e?.preventDefault()
    if (loading) return
    clearErrors()
    const clean = email.trim()
    if (!EMAIL_RE.test(clean)) return setFormError(t('auth.enterEmail'))
    if (isSignUp && role === 'agent' && agencyName.trim().length < 2) return setFormError(t('errors.officeRequired'))
    setEmail(clean)
    setLoading(true)
    const { error } = await auth.sendEmailCode(
      clean,
      isSignUp ? { role, fullName: fullName.trim(), agencyName: agencyName.trim(), language: i18n.resolvedLanguage } : undefined,
    )
    setLoading(false)
    if (error) {
      setCooldown(retryAfterSeconds(error) ?? 0)
      return setFormError(friendlyError(error, t))
    }
    openCodeStep('email', RESEND_WAIT_S, true)
  }

  const verify = async (code, type) => {
    const blocked = blockedCodeKey({ expiresAt, attempts })
    if (blocked) return setNotice({ text: t(blocked), tone: 'error' })
    setOtpVerifying(true)
    const { error } = await auth.verifyCode(email.trim(), code, type)
    setOtpVerifying(false)
    if (!error) return true
    const tries = attempts + 1
    setAttempts(tries)
    setOtpError(true)
    const key = rejectedCodeKey(error, { expiresAt, attempts: tries })
    setNotice({ text: key ? t(key) : friendlyError(error, t), tone: 'error' })
    return false
  }

  const handleVerifyOtp = async (code) => {
    if (code.length < OTP_LENGTH || otpVerifying) return
    if (await verify(code, otpType)) navigate(next, { replace: true })
  }

  const handleResendOtp = async () => {
    setNotice(null)
    const { error } = otpType === 'signup' ? await auth.resendSignupCode(email.trim()) : await auth.sendEmailCode(email.trim())
    if (error) {
      setCooldown(retryAfterSeconds(error) ?? 0)
      return setNotice({ text: friendlyError(error, t), tone: 'error' })
    }
    openCodeStep(otpType, RESEND_WAIT_S, true)
    setNotice({ text: t('auth.newCodeSent'), tone: 'info' })
  }

  const handleForgotPassword = async (e) => {
    e?.preventDefault()
    if (loading) return
    clearErrors()
    const clean = email.trim()
    if (!EMAIL_RE.test(clean)) return setFormError(t('errors.invalidEmail'))
    setEmail(clean)
    setLoading(true)
    const { error } = await auth.sendResetCode(clean)
    setLoading(false)
    if (error) return setFormError(friendlyError(error, t))
    setOtpCode('')
    setOtpError(false)
    setAttempts(0)
    setNotice(null)
    setExpiresAt(codeExpiry())
    setCooldown(RESEND_WAIT_S)
    setRecoveryStep('code')
  }

  const handleVerifyRecovery = async (code) => {
    if (code.length < OTP_LENGTH || otpVerifying) return
    setRecovering(true)
    if (await verify(code, 'recovery')) {
      setNotice(null)
      setRecoveryStep('password')
    } else {
      setRecovering(false)
    }
  }

  const handleSetNewPassword = async (e) => {
    e?.preventDefault()
    if (loading) return
    const weak = passwordStrengthError(newPassword)
    if (weak) return setFormError(t(weak))
    if (newPassword !== confirmNewPassword) return setFormError(t('errors.passwordMismatch'))
    setFormError(null)
    setLoading(true)
    const { error } = await auth.updatePassword(newPassword)
    setLoading(false)
    if (error) return setFormError(friendlyError(error, t))
    setRecovering(false)
    navigate('/account', { replace: true, state: { notice: 'auth.recoverySuccess' } })
  }

  const handleProvider = async (provider) => {
    clearErrors()
    const { error } = await auth.signInWithProvider(provider, next)
    if (error) setFormError(friendlyError(error, t))
  }

  const codeLeft = secondsLeft(expiresAt, now)
  const codeExpired = codeLeft === 0
  const shownNotice = codeExpired && otpType ? { text: t('errors.codeExpired'), tone: 'error' } : notice

  const passwordInput = (value, set, placeholder, autoComplete, withEye) => (
    <Field icon="lock" label={placeholder}>
      <input
        className="a-input"
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete={autoComplete}
        disabled={loading}
      />
      {withEye && (
        <button
          type="button"
          className="a-eye"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={showPassword}
        >
          <Icon name={showPassword ? 'visibilityOff' : 'visibility'} />
        </button>
      )}
    </Field>
  )

  const emailInput = (onEnter) => (
    <Field icon="mail" label={t('auth.email')}>
      <input
        className="a-input"
        type="email"
        placeholder={t('auth.email')}
        aria-label={t('auth.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete={isSignUp ? 'email' : 'username'}
        autoCapitalize="none"
        spellCheck={false}
        onKeyDown={onEnter ? (e) => e.key === 'Enter' && onEnter(e) : undefined}
      />
    </Field>
  )

  let body
  if (recoveryStep === 'email') {
    body = (
      <form className="a-stack" onSubmit={handleForgotPassword} noValidate>
        <h2 className="a-title">{t('auth.forgotTitle')}</h2>
        <p className="a-sub">{t('auth.forgotSubtitle')}</p>
        {emailInput()}
        {formError && <p className="a-sub a-err" role="alert">{formError}</p>}
        <Cta type="submit" disabled={loading}>
          {loading ? t('common.loading') : t('auth.sendCode')}
        </Cta>
        <button type="button" className="a-link" onClick={() => (start === 'recover' ? navigate('/login', { replace: true }) : setRecoveryStep(null))}>
          {t('auth.backToSignIn')}
        </button>
      </form>
    )
  } else if (recoveryStep === 'code') {
    body = (
      <div className="a-stack">
        <h2 className="a-title">{t('auth.enterCode')}</h2>
        <p className="a-sub">{t('auth.codeSentTo', { email })}</p>
        <OtpInput
          value={otpCode}
          error={otpError}
          disabled={otpVerifying}
          onChange={(v) => {
            setOtpCode(v)
            if (otpError) setOtpError(false)
          }}
          onComplete={handleVerifyRecovery}
        />
        {otpVerifying && <p className="a-sub">{t('common.loading')}</p>}
        {shownNotice && (
          <p className={`a-notice ${shownNotice.tone === 'error' ? 'is-error' : ''}`} role="alert">
            {shownNotice.text}
          </p>
        )}
        <button
          type="button"
          className={`a-link ${cooldown > 0 ? 'is-muted' : ''}`}
          onClick={async () => {
            setNotice(null)
            const { error } = await auth.sendResetCode(email.trim())
            if (error) return setNotice({ text: friendlyError(error, t), tone: 'error' })
            setOtpCode('')
            setAttempts(0)
            setExpiresAt(codeExpiry())
            setCooldown(RESEND_WAIT_S)
          }}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resendCode')}
        </button>
        <button type="button" className="a-link" onClick={() => setRecoveryStep('email')}>
          {t('common.back')}
        </button>
      </div>
    )
  } else if (recoveryStep === 'password') {
    body = (
      <form className="a-stack" onSubmit={handleSetNewPassword} noValidate>
        <h2 className="a-title">{t('auth.recoveryTitle')}</h2>
        <p className="a-sub">{t('auth.recoverySubtitle')}</p>
        {passwordInput(newPassword, setNewPassword, t('auth.newPassword'), 'new-password', true)}
        <PasswordChecklist password={newPassword} />
        {passwordInput(confirmNewPassword, setConfirmNewPassword, t('auth.confirmPassword'), 'new-password', false)}
        {formError && <p className="a-sub a-err" role="alert">{formError}</p>}
        <Cta type="submit" disabled={loading}>
          {loading ? t('common.loading') : t('auth.updatePassword')}
        </Cta>
        <button
          type="button"
          className="a-link"
          disabled={loading}
          onClick={() => {
            // The old password stays; the code already signed the person in.
            setRecovering(false)
            setNewPassword('')
            setConfirmNewPassword('')
            setRecoveryStep(null)
            navigate(next, { replace: true })
          }}
        >
          {t('common.back')}
        </button>
      </form>
    )
  } else if (otpType) {
    body = (
      <div className="a-stack">
        <h2 className="a-title">{otpType === 'signup' ? t('auth.verifyEmailTitle') : t('auth.checkInbox')}</h2>
        <p className="a-sub">{t('auth.verifyEmailSubtitle')}</p>
        <p className="a-email">{email}</p>
        <OtpInput
          value={otpCode}
          error={otpError}
          disabled={otpVerifying}
          onChange={(v) => {
            setOtpCode(v)
            if (otpError) setOtpError(false)
          }}
          onComplete={handleVerifyOtp}
        />
        {shownNotice && (
          <p className={`a-notice ${shownNotice.tone === 'error' ? 'is-error' : ''}`} role="alert" aria-live="polite">
            {shownNotice.text}
          </p>
        )}
        {codeLeft != null && codeLeft > 0 && <p className="a-sub">{t('auth.codeExpiresIn', { time: formatCountdown(codeLeft) })}</p>}
        <Cta
          arrow={false}
          onClick={() => handleVerifyOtp(otpCode)}
          disabled={otpCode.length < OTP_LENGTH || otpVerifying || codeExpired}
        >
          {otpVerifying ? t('common.loading') : t('auth.verifyAccount')}
        </Cta>
        <button type="button" className={`a-link ${cooldown > 0 ? 'is-muted' : ''}`} onClick={handleResendOtp} disabled={cooldown > 0}>
          {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resendCode')}
        </button>
        <p className="a-notice">{t('auth.spamHint')}</p>
        {otpType === 'signup' && (
          <button
            type="button"
            className="a-link"
            onClick={() => {
              setOtpType(null)
              setIsSignUp(false)
            }}
          >
            {t('auth.signupCodeHint')}
          </button>
        )}
        <button type="button" className="a-link" onClick={() => setOtpType(null)}>
          {t('common.back')}
        </button>
      </div>
    )
  } else {
    body = (
      <form className="a-stack" onSubmit={emailFirst ? handleSendOtp : handleAuth} noValidate>
        {isSignUp && (
          <Field icon="personOutline" label={t('auth.fullName')}>
            <input
              className="a-input"
              placeholder={t('auth.fullName')}
              aria-label={t('auth.fullName')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={PROFILE_LIMITS.full_name}
              autoComplete="name"
            />
          </Field>
        )}
        {emailInput()}
        {!emailFirst &&
          passwordInput(password, setPassword, t('auth.password'), isSignUp ? 'new-password' : 'current-password', true)}
        {isSignUp && <PasswordChecklist password={password} />}
        {isSignUp && passwordInput(confirmPassword, setConfirmPassword, t('auth.confirmPassword'), 'new-password', false)}
        {isSignUp && role === 'agent' && (
          <Field icon="business" label={t('auth.officeName')}>
            <input
              className="a-input"
              placeholder={t('auth.officeName')}
              aria-label={t('auth.officeName')}
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              maxLength={PROFILE_LIMITS.agency_name}
              autoComplete="organization"
            />
          </Field>
        )}
        {!isSignUp && (
          <div className="a-access">
            <span>{emailFirst ? t('auth.otpSubtitle') : role === 'agent' ? t('auth.accessAgent') : t('auth.accessClient')}</span>
            {!emailFirst && (
              <button type="button" onClick={() => setRecoveryStep('email')}>
                {t('auth.forgotShort')}
              </button>
            )}
          </div>
        )}
        {formError && (
          <div className="a-error" role="alert" aria-live="polite">
            <div className="a-error-row">
              <Icon name="errorOutline" />
              <span>{formError}</span>
            </div>
            {((existingAccount && isSignUp) || (wrongPassword && !isSignUp)) && (
              <>
                <p className="a-error-hint">{isSignUp ? t('auth.existingAccountHint') : t('auth.wrongPasswordHint')}</p>
                <div className="a-error-actions">
                  {isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false)
                        setUseEmailCode(false)
                        setPassword('')
                        setConfirmPassword('')
                        clearErrors()
                        window.history.replaceState(window.history.state, '', '/login')
                      }}
                    >
                      {t('auth.signInThisEmail')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false)
                      clearErrors()
                      setRecoveryStep('email')
                    }}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                  <button type="button" onClick={() => handleProvider('google')}>
                    {t('auth.continueWithGoogleFull')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <Cta type="submit" disabled={loading}>
          {loading ? t('common.loading') : isSignUp ? t('auth.createAccount') : emailFirst ? t('auth.continue') : t('auth.stepInside')}
        </Cta>
        <button type="button" className="a-link" onClick={switchMode}>
          {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')} <strong>{isSignUp ? t('common.signIn') : t('common.signUp')}</strong>
        </button>
        <div className="a-divider">
          <span>{t('auth.signInWith')}</span>
        </div>
        <div className="a-social">
          {providers.google !== false && (
            <button type="button" onClick={() => handleProvider('google')}>
              <GoogleLogo />
              <span>{t('auth.continueWithGoogle')}</span>
            </button>
          )}
          {providers.linkedin_oidc !== false && (
            <button type="button" onClick={() => handleProvider('linkedin_oidc')}>
              <LinkedInLogo />
              <span>{t('auth.continueWithLinkedIn')}</span>
            </button>
          )}
          <button
            type="button"
            className="is-full"
            aria-label={emailFirst ? t('auth.usePassword') : t('auth.signInWithEmail')}
            disabled={loading}
            onClick={
              isSignUp
                ? handleSendOtp
                : () => {
                    setUseEmailCode(!useEmailCode)
                    setFormError(null)
                  }
            }
          >
            <Icon name={emailFirst ? 'lock' : 'mail'} />
            <span>{emailFirst ? t('auth.usePassword') : t('auth.emailCode')}</span>
          </button>
        </div>
        <p className="a-legal">
          <a href="/privacy">{t('legal.privacyPolicy')}</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">{t('legal.termsOfService')}</a>
        </p>
      </form>
    )
  }

  return (
    <div className="a-screen">
      <DuskHero />
      <div className="a-col">
        {/* A plain way out: someone sent here from a signed-in page, or who
            opened this address directly, has no browser history to go back to. */}
        <Link to="/" className="a-home">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('common.home')}
        </Link>
        <div className="a-hero">
          <p className="a-kicker">
            <span className="a-kicker-dash" aria-hidden="true" />
            {isSignUp ? t('auth.kickerSignUp') : t('auth.kickerSignIn')}
          </p>
          <h1 className="a-headline">
            <span>{isSignUp ? t('auth.heroSignUpPre') : t('auth.heroSignInPre')}</span>
            <span className="a-em">{isSignUp ? t('auth.heroSignUpEm') : t('auth.heroSignInEm')}</span>
            <span>{isSignUp ? t('auth.heroSignUpPost') : t('auth.heroSignInPost')}</span>
          </h1>
        </div>
        <div className="a-glass">
          <div className="a-roles" role="radiogroup" aria-label={t('web.auth.accountType')}>
            {[
              ['buyer', 'person', t('auth.roleClient')],
              ['agent', 'businessCenter', t('auth.roleAgent')],
            ].map(([value, icon, label]) => (
              <button key={value} type="button" role="radio" aria-checked={role === value} className={role === value ? 'is-on' : ''} onClick={() => setRole(value)}>
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
          {body}
        </div>
      </div>
    </div>
  )
}

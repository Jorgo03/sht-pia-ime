import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, X } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { friendlyError, retryAfterSeconds } from '../../../lib/authErrors'
import { hasPasswordSignIn, newPasswordError, providerLabels } from '../lib/password'

/**
 * Change the password while signed in (Password & security). The current
 * password is checked on the server before the new one is set, and the other
 * devices are signed out after. Someone who has forgotten the current one gets
 * a code by email instead: the code opens the same new-password screen a
 * reset link does. An account that only signs in with Google or Apple has no
 * password here, and is told so rather than shown a form that cannot work.
 * Passwords live in this component's state only while it is open.
 */
export default function ChangePasswordSheet({ user, onClose }) {
  const { t } = useTranslation()
  const { changePassword, resetPassword, verifyRecoveryCode } = useAuth()
  const [step, setStep] = useState('form') // 'form' | 'code' | 'done'
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [othersSignedOut, setOthersSignedOut] = useState(false)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const working = useRef(false)
  const firstField = useRef(null)

  useEffect(() => {
    firstField.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, step])

  const isCoolingDown = cooldown > 0
  useEffect(() => {
    if (!isCoolingDown) return
    const id = setInterval(() => setCooldown((s) => (s > 1 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [isCoolingDown])

  // One request at a time, whatever fired it (a double click, Enter held down).
  const once = async (fn) => {
    if (working.current) return
    working.current = true
    setBusy(true)
    try { await fn() } finally { working.current = false; setBusy(false) }
  }

  const save = (e) => {
    e.preventDefault()
    setError('')
    if (!current) { setError(t('errors.passwordRequired')); return }
    const invalid = newPasswordError(next, confirm, { current })
    if (invalid) { setError(t(invalid)); return }
    once(async () => {
      const result = await changePassword(current, next)
      if (result.status === 'wrongCurrent') { setError(t('errors.currentPasswordWrong')); return }
      if (result.status === 'failed') { setError(friendlyError(result.error, t)); return }
      setCurrent(''); setNext(''); setConfirm('')
      setOthersSignedOut(result.othersSignedOut)
      setStep('done')
    })
  }

  const sendCode = () => once(async () => {
    setError('')
    const { error: sendError } = await resetPassword(user.email)
    const wait = retryAfterSeconds(sendError)
    if (wait) { setCodeSent(true); setCooldown(wait); setError(t('errors.waitSeconds', { s: wait })); return }
    if (sendError) { setError(friendlyError(sendError, t)); return }
    setCodeSent(true)
    setCooldown(30)
  })

  const verify = (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) { setError(t('errors.invalidCode')); return }
    once(async () => {
      const { error: verifyError } = await verifyRecoveryCode(user.email, code)
      if (verifyError) { setCode(''); setError(friendlyError(verifyError, t)); return }
      // The recovery session is live: the profile page now shows the
      // new-password form (PASSWORD_RECOVERY), so this sheet steps aside.
      onClose()
    })
  }

  const providers = providerLabels(user).join(', ')
  const passwordInput = (props) => (
    <input className="addsheet-input" type={show ? 'text' : 'password'} spellCheck={false} {...props} />
  )

  return (
    <>
      <div className="addsheet-backdrop" onClick={onClose} />
      <div className="addsheet-panel" role="dialog" aria-modal="true" aria-label={t('security.title')}>
        <div className="addsheet-grip" />
        <div className="addsheet-header">
          <h2 className="addsheet-title">{t('security.title')}</h2>
          <button className="addsheet-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        {!hasPasswordSignIn(user) ? (
          <div className="addsheet-miniform">
            <p className="text-[14px] text-fho-text">{t('security.providerOnly', { providers })}</p>
            <button ref={firstField} className="cta-pill" type="button" onClick={onClose}>{t('common.done')}</button>
          </div>
        ) : step === 'done' ? (
          <div className="addsheet-miniform" role="status">
            <p className="text-[15px] font-semibold text-fho-text">{t('security.success')}</p>
            {othersSignedOut && <p className="text-[13px] text-fho-text-muted">{t('security.othersSignedOut')}</p>}
            <button ref={firstField} className="cta-pill" type="button" onClick={onClose}>{t('common.done')}</button>
          </div>
        ) : step === 'code' ? (
          <form className="addsheet-miniform" onSubmit={verify} noValidate>
            <p className="text-[14px] text-fho-text">{t('security.codeIntro', { email: user.email })}</p>
            {!codeSent ? (
              <button ref={firstField} className="cta-pill" type="button" disabled={busy} onClick={sendCode}>
                {busy ? t('common.loading') : t('auth.sendCode')}
              </button>
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-fho-text">
                  {t('auth.enterCode')}
                  <input
                    ref={firstField}
                    className="addsheet-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                  />
                </label>
                <button className="cta-pill" type="submit" disabled={busy}>
                  {busy ? t('common.loading') : t('authConfirm.ctaRecovery')}
                </button>
                <button type="button" className="link-btn text-fho-text underline" disabled={busy || cooldown > 0} onClick={sendCode}>
                  {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resendCode')}
                </button>
              </>
            )}
            {error && <div className="nl-error" role="alert">{error}</div>}
            <button type="button" className="ghost-btn" onClick={() => { setStep('form'); setError('') }}>
              {t('common.back')}
            </button>
          </form>
        ) : (
          <form className="addsheet-miniform" onSubmit={save} noValidate>
            {/* For password managers: which account this password belongs to. */}
            <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-fho-text">
              {t('security.currentPassword')}
              {passwordInput({ ref: firstField, autoComplete: 'current-password', value: current, onChange: (e) => { setCurrent(e.target.value); setError('') } })}
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-fho-text">
              {t('auth.newPassword')}
              {passwordInput({ autoComplete: 'new-password', value: next, onChange: (e) => { setNext(e.target.value); setError('') }, 'aria-describedby': 'change-password-rule' })}
              <span id="change-password-rule" className="text-[12px] font-normal text-fho-text-muted">{t('errors.passwordMin')}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-fho-text">
              {t('auth.confirmPassword')}
              {passwordInput({ autoComplete: 'new-password', value: confirm, onChange: (e) => { setConfirm(e.target.value); setError('') } })}
            </label>
            <button type="button" className="link-btn self-start inline-flex items-center gap-1.5 text-fho-text" onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
              {show ? t('auth.hidePassword') : t('auth.showPassword')}
            </button>
            {error && <div className="nl-error" role="alert">{error}</div>}
            <button className="cta-pill" type="submit" disabled={busy}>
              {busy ? t('common.loading') : t('security.save')}
            </button>
            <button type="button" className="link-btn text-fho-text underline" onClick={() => { setStep('code'); setError('') }}>
              {t('security.forgotCurrent')}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

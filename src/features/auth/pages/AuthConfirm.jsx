import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import DuskHero from '../components/DuskHero'
import { emailLinkFrom, linkErrorKey } from '../lib/authLinks'
import { friendlyError } from '../../../lib/authErrors'
import '../../../styles/profile.css'

/**
 * Where every auth email's link lands: /auth/confirm?token_hash=…&type=…
 * (supabase/templates). Verifying a token_hash needs nothing from the browser
 * that asked, so the link works on any device, unlike the PKCE ?code= links,
 * which only work in the browser that holds the verifier.
 *
 * Nothing happens until the person presses the button. Mail scanners and link
 * previews open links on their own; had this page verified on load, they would
 * use up the one-time token and the person's own click would find it expired.
 *
 * The page only ever goes to its own fixed routes, never to an address taken
 * from the link, so the link cannot send anyone elsewhere.
 */
export default function AuthConfirm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Read once: the token then leaves the address bar (and the history entry).
  const [link] = useState(() => emailLinkFrom(window.location.href))
  const [state, setState] = useState(link ? 'ready' : 'failed') // 'ready' | 'working' | 'done' | 'failed'
  const [errorText, setErrorText] = useState(link ? '' : t('errors.linkInvalid'))
  const busy = useRef(false)

  useEffect(() => {
    window.history.replaceState(window.history.state, '', '/auth/confirm')
  }, [])

  const isRecovery = link?.type === 'recovery'
  const isEmailChange = link?.type === 'email_change'
  const title = isRecovery ? t('authConfirm.titleRecovery') : isEmailChange ? t('authConfirm.titleEmailChange') : t('authConfirm.titleEmail')
  const cta = isRecovery ? t('authConfirm.ctaRecovery') : isEmailChange ? t('authConfirm.ctaEmailChange') : t('authConfirm.ctaEmail')

  const confirm = async () => {
    if (busy.current || !link) return
    busy.current = true
    setState('working')
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      if (error) {
        setErrorText(error.code === 'otp_expired' || error.status === 403 ? t(linkErrorKey(error)) : friendlyError(error, t))
        setState('failed')
        return
      }
      // Recovery: PASSWORD_RECOVERY is set, so the profile page shows the
      // new-password form. A confirmed address or a sign-in link: signed in.
      if (isRecovery) navigate('/profile', { replace: true })
      else if (isEmailChange) setState('done')
      else navigate('/', { replace: true })
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="profile-page auth-screen">
      <DuskHero />
      <div className="auth-content">
        <div className="auth-glass">
          <div className="otp-icon">{isRecovery ? <Lock size={32} /> : <Mail size={32} />}</div>
          <h1 className="auth-title">{title}</h1>
          {state === 'done' ? (
            <>
              <p className="auth-subtitle" role="status">{t('authConfirm.emailChanged')}</p>
              <button className="cta-pill" onClick={() => navigate('/profile', { replace: true })}>{t('common.done')}</button>
            </>
          ) : state === 'failed' ? (
            <>
              <div className="auth-message auth-message--error" role="alert">{errorText}</div>
              <button className="cta-pill" onClick={() => navigate('/profile', { replace: true, state: { intent: isRecovery ? 'forgot' : 'signin' } })}>
                {isRecovery ? t('authConfirm.requestNew') : t('authConfirm.goSignIn')}
              </button>
            </>
          ) : (
            <>
              <p className="auth-subtitle">{t('authConfirm.intro')}</p>
              <button className="cta-pill" onClick={confirm} disabled={state === 'working'}>
                {state === 'working' ? t('common.loading') : cta}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'

export default function AuthCallback() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const settled = useRef(false)

  useEffect(() => {
    // Providers/GoTrue report failures via error params (query for PKCE,
    // hash for implicit), and a malformed redirect carries neither a code
    // nor tokens. Both mean no session will ever arrive from THIS redirect —
    // fail fast instead of holding the spinner for the full timeout. Works
    // identically for google / apple / linkedin_oidc: same params, same flow.
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const hasError = query.has('error') || hash.has('error')
    const hasCredentials = query.has('code') || hash.has('access_token')

    if (hasError || !hasCredentials) {
      supabase.auth.getSession().then(({ data }) => {
        if (settled.current) return
        settled.current = true
        // An already-signed-in user landing here (e.g. stale bookmark) goes
        // home; everyone else gets the sign-in screen with an error message.
        if (data.session && !hasError) navigate('/', { replace: true })
        else navigate('/profile?error=oauth_failed', { replace: true })
      })
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled.current) return
      if (event === 'SIGNED_IN' && session) {
        settled.current = true
        navigate('/', { replace: true })
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (settled.current) return
      if (data.session) {
        settled.current = true
        navigate('/', { replace: true })
      }
    })

    const timeout = setTimeout(() => {
      if (settled.current) return
      settled.current = true
      navigate('/profile?error=oauth_failed', { replace: true })
    }, 10000)

    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--fho-bg, #111)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '2px solid var(--fho-orange-1, #FF6B00)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        marginBottom: 16,
        animation: 'spin 1s linear infinite',
      }} />
      <p style={{ color: 'var(--fho-text, #fff)', fontSize: 14 }}>{t('authCallback.signingIn')}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/AuthContext'

export default function WelcomeToast() {
  const { t } = useTranslation()
  const { user, session, welcomeName, clearWelcome } = useAuth()

  useEffect(() => {
    if (!user || !session || !welcomeName) return
    const id = setTimeout(clearWelcome, 3500)
    return () => clearTimeout(id)
  // user/session are read only as guards; depending on their object identity
  // would restart the dismiss timer every time Supabase refreshes the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, welcomeName, clearWelcome])

  if (!user || !session || !welcomeName) return null

  return (
    <div className="welcome-toast" onClick={clearWelcome}>
      {t('account.welcomeBack', { name: welcomeName })}
    </div>
  )
}

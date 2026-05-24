import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function WelcomeToast() {
  const { t } = useTranslation()
  const { welcomeName, clearWelcome } = useAuth()

  useEffect(() => {
    if (!welcomeName) return
    const id = setTimeout(clearWelcome, 3500)
    return () => clearTimeout(id)
  }, [welcomeName, clearWelcome])

  if (!welcomeName) return null

  return (
    <div className="welcome-toast" onClick={clearWelcome}>
      {t('account.welcomeBack', { name: welcomeName })}
    </div>
  )
}

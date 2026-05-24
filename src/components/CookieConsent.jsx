import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'fho_cookie_consent'

export default function CookieConsent() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !localStorage.getItem(STORAGE_KEY))

  if (!visible) return null

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  return (
    <div className="cookie-banner">
      <div className="cookie-text">{t('cookie.message')}</div>
      <button className="cookie-accept" onClick={accept}>{t('cookie.accept')}</button>
    </div>
  )
}

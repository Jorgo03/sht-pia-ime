import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** The two-column frame shared by the sign-in, sign-up and reset pages. */
export default function AuthLayout({ title, lead, children }) {
  const { t } = useTranslation()
  useEffect(() => {
    document.title = `${title} | ${t('common.appName')}`
  }, [title, t])
  return (
    <div className="auth">
      <div className="auth-photo" aria-hidden="true">
        <img src="/images/hero-1280.webp" alt="" />
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h1>{title}</h1>
          {lead && <p className="auth-lead">{lead}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

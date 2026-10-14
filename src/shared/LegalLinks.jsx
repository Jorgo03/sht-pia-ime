import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Privacy Policy · Terms of Service. Google's OAuth brand verification needs
// the home page to link to the privacy policy, and both stores expect it to be
// reachable from the app, so this sits on Home and Profile.
export default function LegalLinks({ className = '' }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('legal.privacyPolicy')} className={`flex items-center justify-center gap-2 text-xs text-fho-text-faint ${className}`}>
      <Link className="text-fho-text-muted underline hover:text-fho-orange-2" to="/privacy">{t('legal.privacyPolicy')}</Link>
      <span aria-hidden="true">·</span>
      <Link className="text-fho-text-muted underline hover:text-fho-orange-2" to="/terms">{t('legal.termsOfService')}</Link>
    </nav>
  )
}

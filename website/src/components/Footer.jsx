import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Logo from './Logo'
import LanguageSelect from './LanguageSelect'

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" aria-label={t('common.appName')}>
            <Logo />
          </Link>
          <p>{t('site.footer.tagline')}</p>
          <LanguageSelect />
        </div>
        <nav aria-label={t('site.footer.explore')}>
          <h2>{t('site.footer.explore')}</h2>
          <Link to="/search?deal=sale">{t('web.nav.buy')}</Link>
          <Link to="/search?deal=rent">{t('web.nav.rent')}</Link>
          <Link to="/#agents">{t('site.nav.agencies')}</Link>
          <Link to="/#app">{t('web.nav.app')}</Link>
        </nav>
        <nav aria-label={t('site.footer.legal')}>
          <h2>{t('site.footer.legal')}</h2>
          {/* Static pages built by scripts/build-website.mjs, so full page loads. */}
          <a href="/privacy">{t('legal.privacyPolicy')}</a>
          <a href="/terms">{t('legal.termsOfService')}</a>
          <a href="/cookies">{t('legal.cookiePolicy')}</a>
        </nav>
      </div>
      <div className="container footer-base">
        <p>{t('site.footer.copyright', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  )
}

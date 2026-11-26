import { useTranslation } from 'react-i18next'

// App Store and Google Play badges for the footer. The apps are not in the
// stores yet, so these are shown as "coming soon", never as dead links; when a
// store listing exists, turn each <span> into an <a href> to it.
function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}

function PlayLogo() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path fill="#00d7fe" d="M3.6 2.3 13.4 12l-9.8 9.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1z" />
      <path fill="#00f076" d="M3.6 2.3c.4-.2.9-.2 1.4.1l11.3 6.5-2.9 3.1z" />
      <path fill="#ff3a44" d="M13.4 12l2.9 3.1L5 21.6c-.5.3-1 .3-1.4.1z" />
      <path fill="#ffd400" d="m16.3 8.9 3.6 2.1c.7.4.7 1.6 0 2l-3.6 2.1-2.9-3.1z" />
    </svg>
  )
}

export default function StoreBadges() {
  const { t } = useTranslation()
  return (
    <div id="app" className="store-badges">
      <div className="badge-row">
        <span className="store-badge" aria-disabled="true" title={t('web.app.soon')}>
          <AppleLogo />
          <span>
            <small>{t('web.app.downloadOn')}</small>
            <strong>{t('web.app.appStore')}</strong>
          </span>
        </span>
        <span className="store-badge" aria-disabled="true" title={t('web.app.soon')}>
          <PlayLogo />
          <span>
            <small>{t('web.app.getItOn')}</small>
            <strong>{t('web.app.googlePlay')}</strong>
          </span>
        </span>
      </div>
      <p className="store-soon">{t('web.app.soon')}</p>
    </div>
  )
}

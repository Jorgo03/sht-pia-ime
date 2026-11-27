import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SearchX } from 'lucide-react'

export default function NotFound({ title, hint }) {
  const { t } = useTranslation()
  useEffect(() => {
    document.title = `${title ?? t('notFound.title')} | ${t('common.appName')}`
  }, [t, title])
  return (
    <div className="page container section">
      {/* EmptyState's look, with the title as the page's heading. */}
      <div className="state">
        <SearchX size={28} aria-hidden="true" />
        <h1 className="state-title">{title ?? t('notFound.title')}</h1>
        <p>{hint ?? t('notFound.subtitle')}</p>
        <Link to="/search" className="btn btn-primary">
          {t('site.cta.search')}
        </Link>
      </div>
    </div>
  )
}

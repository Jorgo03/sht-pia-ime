import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/States'

export default function NotFound({ title, hint }) {
  const { t } = useTranslation()
  useEffect(() => {
    document.title = `${title ?? t('notFound.title')} | ${t('common.appName')}`
  }, [t, title])
  return (
    <div className="page container section">
      <EmptyState title={title ?? t('notFound.title')} hint={hint ?? t('notFound.subtitle')}>
        <Link to="/search" className="btn btn-primary">
          {t('site.cta.search')}
        </Link>
      </EmptyState>
    </div>
  )
}

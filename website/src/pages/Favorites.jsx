import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PropertyCard, { CardSkeleton } from '../components/PropertyCard'
import { EmptyState, ErrorState } from '../components/States'
import { useAuth } from '../auth/AuthContext'
import { useFavorites } from '../features/favorites'

export default function Favorites() {
  const { t } = useTranslation()
  const { session, ready } = useAuth()
  const { homes, status, reload } = useFavorites()

  useEffect(() => {
    document.title = `${t('favourites.title')} | ${t('common.appName')}`
  }, [t])

  if (ready && !session) return <Navigate to="/login?next=/favorites" replace />

  return (
    <div className="page container section">
      <div className="section-head">
        <div>
          <h1 className="page-title">{t('favourites.title')}</h1>
          <p>{status === 'ready' ? t('favourites.savedCount', { count: homes.length }) : t('favourites.subtitle')}</p>
        </div>
      </div>
      {status === 'error' ? (
        <ErrorState onRetry={reload} />
      ) : status !== 'ready' ? (
        <div className="grid">
          {Array.from({ length: 3 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : homes.length === 0 ? (
        <EmptyState title={t('favourites.emptyDescription')}>
          <Link to="/search" className="btn btn-primary">
            {t('site.cta.search')}
          </Link>
        </EmptyState>
      ) : (
        <div className="grid">
          {homes.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  )
}

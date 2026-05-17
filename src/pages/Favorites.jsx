import { Heart, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PropertyCard from '../components/PropertyCard'
import SkeletonCard from '../components/SkeletonCard'
import { useAuth } from '../contexts/AuthContext'
import { useFavorites } from '../contexts/FavoritesContext'

export default function Favorites() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { favoriteProperties, loading } = useFavorites()

  if (authLoading) return null

  if (!user) {
    return (
      <div className="page">
        <h1 className="page-title">{t('favourites.title')}</h1>
        <p className="page-subtitle">{t('favourites.subtitle')}</p>
        <div className="placeholder-card empty-state">
          <div className="icon"><LogIn size={32} /></div>
          <div style={{ fontWeight: 500 }}>{t('favourites.loginPrompt')}</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', padding: '10px 24px' }}
            onClick={() => navigate('/profile')}
          >
            {t('favourites.loginCta')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('favourites.title')}</h1>
      <p className="page-subtitle">{t('favourites.subtitle')}</p>

      {loading ? (
        <div className="property-grid">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : favoriteProperties.length === 0 ? (
        <div className="placeholder-card empty-state">
          <div className="icon"><Heart size={32} /></div>
          <div style={{ fontWeight: 500 }}>{t('favourites.empty')}</div>
          <div>{t('favourites.emptyDescription')}</div>
        </div>
      ) : (
        <div className="property-grid">
          {favoriteProperties.map(p => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  )
}

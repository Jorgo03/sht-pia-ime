import { Heart, LogIn, MapPin, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { useFavorites } from '../FavoritesContext'
import { formatPrice, imageFor, getLocalizedText, priceSuffixKey } from '../../../lib/format'
import SkeletonCard from '../../../shared/SkeletonCard'
import { useState } from 'react'

export default function Favorites() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { favoriteProperties, loading, toggle } = useFavorites()

  if (authLoading || loading) {
    return (
      <div className="page">
        <div className="screen-head"><div className="screen-kicker"><span className="screen-kicker__dash" />{t('common.loading')}</div></div>
        <div className="property-grid" style={{ padding: '0' }}>{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page">
        <button className="fav-back" onClick={() => navigate('/profile')}>{t('favourites.backToProfile')}</button>
        <div className="screen-head" style={{ padding: 0 }}>
          <div className="screen-kicker"><span className="screen-kicker__dash" />{t('favourites.kicker')}</div>
          <h1 className="screen-headline">{t('favourites.headlinePre')} <em>{t('favourites.headlineEm')}</em>.</h1>
        </div>
        <div className="placeholder-card" style={{ marginTop: 24 }}>
          <div className="icon"><LogIn size={32} /></div>
          <div style={{ fontWeight: 500 }}>{t('favourites.loginPrompt')}</div>
          <button className="cta-pill" style={{ marginTop: 16, maxWidth: 200 }} onClick={() => navigate('/profile')}>{t('favourites.loginCta')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <button className="fav-back" onClick={() => navigate('/profile')}>{t('favourites.backToProfile')}</button>
      <div className="screen-head" style={{ padding: 0 }}>
        <div className="screen-kicker"><span className="screen-kicker__dash" />{t('favourites.savedCount', { count: favoriteProperties.length })}</div>
        <h1 className="screen-headline">{t('favourites.headlinePre')} <em>{t('favourites.headlineEm')}</em>.</h1>
      </div>

      {favoriteProperties.length === 0 ? (
        <div className="fav-empty">
          <span style={{ fontSize: 40 }}>🤍</span>
          <p>{t('favourites.empty')}</p>
        </div>
      ) : (
        <div className="fav-list">
          {favoriteProperties.map(p => <FavRow key={p.id} property={p} lang={i18n.language} onUnsave={() => toggle(p.id)} onTap={() => navigate(`/property/${p.id}`)} />)}
        </div>
      )}
    </div>
  )
}

function FavRow({ property, lang, onUnsave, onTap }) {
  const { t } = useTranslation()
  const [imgBroken, setImgBroken] = useState(false)
  const hasImage = property.image_urls?.[0] && !imgBroken
  const title = getLocalizedText(property.title_i18n, lang) || property.title
  const price = formatPrice(property.price, lang, property.currency)
  const suffixKey = priceSuffixKey(property.listing_type)
  const suffix = suffixKey ? t(suffixKey) : ''

  return (
    <div className="fav-row" role="button" tabIndex={0} onClick={onTap} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}>
      <div className="fav-row__img">
        {hasImage ? (
          <img src={property.image_urls[0]} alt={title} loading="lazy" decoding="async" onError={() => setImgBroken(true)} />
        ) : (
          <div className="fav-row__placeholder" style={{ background: imageFor(property) }} />
        )}
      </div>
      <div className="fav-row__body">
        <h3 className="fav-row__title">{title}</h3>
        <div className="fav-row__loc"><MapPin size={12} /> {property.city || property.address}</div>
        <div className="fav-row__price">{price}{suffix}</div>
      </div>
      <button className="fav-row__heart" onClick={e => { e.stopPropagation(); onUnsave() }} aria-label={t('favourites.remove')}>
        <Heart size={16} fill="currentColor" />
      </button>
    </div>
  )
}

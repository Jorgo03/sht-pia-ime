import { memo, useState } from 'react'
import { Heart, MapPin, Bed, Bath, Ruler } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatPrice, imageFor, getLocalizedText, listingBadgeKey, priceSuffixKey } from '../../../lib/format'
import { useFavorites } from '../../favorites/FavoritesContext'
import { useAuth } from '../../auth/AuthContext'

function FeaturedCard({ property }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { isFavorite, toggle } = useFavorites()
  const saved = isFavorite(property.id)
  const [imgBroken, setImgBroken] = useState(false)

  const hasImage = property.image_urls?.[0] && !imgBroken
  const price = formatPrice(property.price, i18n.language, property.currency)
  const suffixKey = priceSuffixKey(property.listing_type)
  const suffix = suffixKey ? t(suffixKey) : ''
  const title = getLocalizedText(property.title_i18n, i18n.language) || property.title
  const badge = t(listingBadgeKey(property.listing_type))

  const open = () => navigate(`/property/${property.id}`)
  const keyOpen = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }

  const handleFavorite = (e) => {
    e.stopPropagation()
    if (!user) { navigate('/profile'); return }
    toggle(property.id)
  }

  return (
    <div className="featured-card" role="button" tabIndex={0} onClick={open} onKeyDown={keyOpen}>
      <div className="featured-card__img">
        {hasImage ? (
          <img className="featured-card__img-bg" src={property.image_urls[0]} alt={title} loading="lazy" decoding="async" onError={() => setImgBroken(true)} />
        ) : (
          <div className="featured-card__img-placeholder" style={{ background: imageFor(property) }} />
        )}
        <span className="featured-card__badge">{badge}</span>
        <button className={`featured-card__heart ${saved ? 'saved' : ''}`} onClick={handleFavorite} aria-label={t('common.save')}>
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="featured-card__body">
        <h3 className="featured-card__title">{title}</h3>
        <div className="featured-card__location">
          <MapPin size={14} /> {property.city || property.address}
        </div>
        <div className="featured-card__stats">
          {/* *Count keys, not the bare property.beds/baths — those are the
              form-field labels and carry no plural forms, so a 1-bed listing
              read "1 beds". The number stays its own node; count only drives
              i18next's category choice. */}
          {property.beds > 0 && <span className="stat-chip"><Bed size={14} /> {property.beds} {t('property.bedsCount', { count: property.beds })}</span>}
          <span className="stat-chip"><Bath size={14} /> {property.baths} {t('property.bathsCount', { count: property.baths })}</span>
          <span className="stat-chip"><Ruler size={14} /> {property.sqft}{t('property.sqft')}</span>
        </div>
        <div className="featured-card__price">{price}{suffix}</div>
      </div>
    </div>
  )
}

export default memo(FeaturedCard)

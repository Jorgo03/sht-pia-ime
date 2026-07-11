import { memo, useState } from 'react'
import { Heart, MapPin, Bed } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatPrice, imageFor, getLocalizedText, priceSuffixKey } from '../../../lib/format'
import { useFavorites } from '../../favorites/FavoritesContext'
import { useAuth } from '../../auth/AuthContext'

function PropertyCard({ property, variant }) {
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

  const open = () => navigate(`/property/${property.id}`)
  const keyOpen = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }

  const handleFavorite = (e) => {
    e.stopPropagation()
    if (!user) { navigate('/profile'); return }
    toggle(property.id)
  }

  if (variant === 'compact') {
    return (
      <div className="compact-card" role="button" tabIndex={0} onClick={open} onKeyDown={keyOpen}>
        <div className="compact-card__img">
          {hasImage ? (
            <img className="compact-card__img-bg" src={property.image_urls[0]} alt={title} loading="lazy" decoding="async" onError={() => setImgBroken(true)} />
          ) : (
            <div className="compact-card__img-placeholder" style={{ background: imageFor(property) }} />
          )}
          <button className={`compact-card__heart ${saved ? 'saved' : ''}`} onClick={handleFavorite} aria-label={t('common.save')}>
            <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="compact-card__body">
          <h3 className="compact-card__title">{title}</h3>
          <div className="compact-card__loc"><MapPin size={11} /> {property.city || property.address}</div>
          <div className="compact-card__footer">
            <span className="compact-card__price">{price}{suffix}</span>
            {property.beds > 0 && <span className="compact-card__beds"><Bed size={12} /> {property.beds}</span>}
          </div>
        </div>
      </div>
    )
  }

  const bg = hasImage
    ? { backgroundImage: `url(${property.image_urls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: imageFor(property) }

  return (
    <div className="mini-card" role="button" tabIndex={0} onClick={open} onKeyDown={keyOpen} aria-label={title}>
      <div className="mini-img" style={bg}>
        {hasImage && <img src={property.image_urls[0]} alt="" loading="lazy" decoding="async" onError={() => setImgBroken(true)} style={{ display: 'none' }} />}
        <button className={`heart-mini ${saved ? 'saved' : ''}`} onClick={handleFavorite} aria-label={t('common.save')}>
          <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="mini-price">{price}{suffix}</div>
      <div className="mini-loc"><MapPin size={10} /> {property.city || property.address}</div>
    </div>
  )
}

export default memo(PropertyCard)

import { Heart, Bed, Bath, Ruler } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatPrice, imageFor } from '../lib/format'
import { useFavorites } from '../contexts/FavoritesContext'

export default function FeaturedCard({ property }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isFavorite, toggle } = useFavorites()
  const saved = isFavorite(property.id)

  const bg = property.image_urls?.[0]
    ? { backgroundImage: `url(${property.image_urls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: imageFor(property) }

  const price = formatPrice(property.price, i18n.language)
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : ''

  return (
    <div className="featured-card" style={bg} onClick={() => navigate(`/property/${property.id}`)}>
      <div className="row-top">
        <div className="badge">{t('property.featured')}</div>
        <button
          className={`heart-btn ${saved ? 'saved' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggle(property.id) }}
          aria-label={t('common.save')}
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="featured-info">
        <div className="price">{price}{suffix}</div>
        <div className="name">{property.title} · {property.city}</div>
        <div className="meta">
          {property.beds > 0 && <span><Bed size={13} /> {property.beds} {t('property.beds')}</span>}
          <span><Bath size={13} /> {property.baths} {t('property.baths')}</span>
          <span><Ruler size={13} /> {property.sqft}{t('property.sqft')}</span>
        </div>
      </div>
    </div>
  )
}

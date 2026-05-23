import { Heart, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatPrice, imageFor } from '../lib/format'
import { useFavorites } from '../contexts/FavoritesContext'
import { useAuth } from '../contexts/AuthContext'

export default function PropertyCard({ property }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { isFavorite, toggle } = useFavorites()
  const saved = isFavorite(property.id)

  const bg = property.image_urls?.[0]
    ? { backgroundImage: `url(${property.image_urls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: imageFor(property) }

  const price = formatPrice(property.price, i18n.language)
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : ''

  const handleFavorite = (e) => {
    e.stopPropagation()
    if (!user) { navigate('/profile'); return }
    toggle(property.id)
  }

  return (
    <div className="mini-card" onClick={() => navigate(`/property/${property.id}`)}>
      <div className="mini-img" style={bg}>
        <button
          className={`heart-mini ${saved ? 'saved' : ''}`}
          onClick={handleFavorite}
          aria-label={t('common.save')}
        >
          <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="mini-price">{price}{suffix}</div>
      <div className="mini-loc">
        <MapPin size={10} /> {property.city || property.address}
      </div>
    </div>
  )
}

import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Bath, BedDouble, MapPin, Ruler } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gradientFor } from '@/src/lib/format.js'
import { cityName, listingBadgeKey, priceOf, priceSuffixKey, titleOf } from '../lib/format'

function PropertyCard({ property: p }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const photo = p.image_urls?.[0]
  const suffix = priceSuffixKey(p.listing_type)
  const place = [p.zone, cityName(p.city, lang)].filter(Boolean).join(', ')

  return (
    <article className="card">
      <div className="card-media" style={photo ? undefined : { background: gradientFor(p.id) }}>
        {photo && <img src={photo} alt="" loading="lazy" decoding="async" />}
        <span className="badge">{t(listingBadgeKey(p.listing_type))}</span>
      </div>
      <div className="card-body">
        <p className="card-price">
          {priceOf(p, lang)}
          {suffix && <span className="card-suffix">{t(suffix)}</span>}
        </p>
        <h3 className="card-title">
          <Link to={`/property/${p.id}`} className="card-link">
            {titleOf(p, lang)}
          </Link>
        </h3>
        {place && (
          <p className="card-place">
            <MapPin size={14} aria-hidden="true" />
            {place}
          </p>
        )}
        <ul className="card-facts">
          {p.beds != null && (
            <li>
              <BedDouble size={16} aria-hidden="true" />
              {p.beds} <span className="visually-hidden">{t('property.beds')}</span>
            </li>
          )}
          {p.baths != null && (
            <li>
              <Bath size={16} aria-hidden="true" />
              {p.baths} <span className="visually-hidden">{t('property.baths')}</span>
            </li>
          )}
          {p.sqft != null && (
            <li>
              <Ruler size={16} aria-hidden="true" />
              {p.sqft} {t('property.sqft')}
            </li>
          )}
        </ul>
      </div>
    </article>
  )
}

export default memo(PropertyCard)

export function CardSkeleton() {
  return (
    <div className="card is-skeleton" aria-hidden="true">
      <div className="card-media" />
      <div className="card-body">
        <span className="sk sk-price" />
        <span className="sk sk-line" />
        <span className="sk sk-line short" />
      </div>
    </div>
  )
}

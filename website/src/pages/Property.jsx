import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bath, BedDouble, Building, CalendarDays, ChevronLeft, ChevronRight, MapPin, Ruler } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gradientFor } from '@/src/lib/format.js'
import { formatRef } from '@/src/features/properties/lib/searchFilters.js'
import { ErrorState } from '../components/States'
import NotFound from './NotFound'
import ListingAssistant from '../components/ListingAssistant'
import { AI_CHAT_ENABLED } from '../lib/features'
import { getProperty } from '../lib/api'
import { addRecentlyViewed, ContactPanel, logActivity, PriceHistory, SimilarHomes } from '../features/listing'
import { cityName, getLocalizedText, listingBadgeKey, priceSuffixKey, titleOf } from '../lib/format'
import { useCurrency } from '../features/currency'

const LocationMap = lazy(() => import('../components/LocationMap'))

function Gallery({ photos, title, id }) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  if (!photos.length) return <div className="gallery-main" style={{ background: gradientFor(id) }} />
  const go = (d) => setI((n) => (n + d + photos.length) % photos.length)
  return (
    <div
      className="gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label={title}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="gallery-main">
        {/* The first photo is what the page opens on, so it loads at once. */}
        <img src={photos[i]} alt={t('web.gallery.count', { n: i + 1, total: photos.length })} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
        {photos.length > 1 && (
          <>
            <button type="button" className="gallery-btn is-prev" onClick={() => go(-1)} aria-label={t('web.gallery.prev')}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" className="gallery-btn is-next" onClick={() => go(1)} aria-label={t('web.gallery.next')}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <span className="gallery-count" aria-live="polite">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <ul className="thumbs">
          {photos.map((src, n) => (
            <li key={src}>
              <button type="button" onClick={() => setI(n)} aria-current={n === i} aria-label={t('web.gallery.count', { n: n + 1, total: photos.length })}>
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Property() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { formatListingPrice } = useCurrency()
  const q = useQuery({ queryKey: ['property', id], queryFn: () => getProperty(id) })
  const p = q.data
  const title = p ? titleOf(p, lang) : ''

  useEffect(() => {
    if (!p?.id) return
    logActivity(p.id, 'view').catch(() => {})
    addRecentlyViewed(p.id)
  }, [p?.id])

  useEffect(() => {
    if (title) document.title = `${title} | ${t('common.appName')}`
  }, [title, t])

  if (q.isError) {
    return (
      <div className="page container section">
        <ErrorState onRetry={() => q.refetch()} />
      </div>
    )
  }
  if (q.isPending) {
    return (
      <div className="page container section property is-skeleton" aria-busy="true">
        <div className="gallery-main" />
      </div>
    )
  }
  if (!p) return <NotFound title={t('web.property.gone')} hint={t('search.emptyHint')} />

  const description = getLocalizedText(p.description_i18n, lang) || p.description
  const place = [p.address, p.zone, cityName(p.city, lang)].filter(Boolean).join(', ')
  const facts = [
    p.beds != null && [BedDouble, t('property.beds'), p.beds],
    p.baths != null && [Bath, t('property.baths'), p.baths],
    p.sqft != null && [Ruler, t('listing.surface'), `${p.sqft} ${t('property.sqft')}`],
    p.floor != null && [Building, t('listing.floor'), p.total_floors ? t('web.property.floorOf', { floor: p.floor, total: p.total_floors }) : p.floor],
    p.year_built != null && [CalendarDays, t('listing.yearBuilt'), p.year_built],
  ].filter(Boolean)
  const hasMap = p.latitude != null && p.longitude != null

  return (
    <div className="page container section-tight">
      <Link to="/search" className="text-link back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {t('web.property.back')}
      </Link>
      <div className="property">
        <div className="property-main">
          <Gallery key={p.id} photos={p.image_urls ?? []} title={title} id={p.id} />
          {p.status !== 'active' && (
            // Only the owner, the agent or a moderator can open a listing
            // that is not live; say so, so it is not mistaken for public.
            <p className="property-status" role="status">
              <span className={`pill status-${p.status === 'paused' ? 'requested' : 'declined'}`}>
                {p.status === 'pending_review' ? t('moderation.hiddenBadge') : t(`listing.status.${p.status}`, { defaultValue: p.status })}
              </span>
            </p>
          )}
          <header className="property-head">
            <h1>{title}</h1>
            {place && (
              <p className="card-place">
                <MapPin size={16} aria-hidden="true" />
                {place}
              </p>
            )}
            {/* Phones: the price right under the title (the side panel, with
                the same price, comes after the listing there). */}
            <p className="property-head-price">
              <span className="badge is-inline">{t(listingBadgeKey(p.listing_type))}</span>
              <span className="contact-price">
                {formatListingPrice(p.price, p.currency)}
                {priceSuffixKey(p.listing_type) && <span className="card-suffix">{t(priceSuffixKey(p.listing_type))}</span>}
              </span>
            </p>
            {p.ref_code && (
              <p className="property-ref">
                {t('detail.reference')} {formatRef(p.ref_code)}
              </p>
            )}
          </header>
          {facts.length > 0 && (
            <dl className="facts">
              {facts.map(([Icon, label, value]) => (
                <div key={label}>
                  <dt>
                    <Icon size={18} aria-hidden="true" />
                    {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {AI_CHAT_ENABLED && p.status === 'active' && <ListingAssistant key={p.id} property={p} />}
          {description && (
            <section aria-labelledby="desc-title">
              <h2 id="desc-title">{t('listing.description')}</h2>
              <p className="description">{description}</p>
            </section>
          )}
          {p.features?.length > 0 && (
            <section aria-labelledby="features-title">
              <h2 id="features-title">{t('listing.features')}</h2>
              <ul className="chips">
                {p.features.map((f) => (
                  <li key={f}>{t(`listing.feature.${f}`, { defaultValue: f })}</li>
                ))}
              </ul>
            </section>
          )}
          {p.video_url && (
            <section aria-labelledby="video-title">
              <h2 id="video-title">{t('detail.video')}</h2>
              <video className="video" src={p.video_url} controls preload="metadata" playsInline />
            </section>
          )}
          {hasMap && (
            <section aria-labelledby="map-title">
              <h2 id="map-title">{t('property.location')}</h2>
              <Suspense fallback={<div className="map" />}>
                <LocationMap lat={p.latitude} lng={p.longitude} label={place} />
              </Suspense>
              <a
                className="text-link"
                href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin size={16} aria-hidden="true" />
                {t('map.openInMaps')}
              </a>
            </section>
          )}
          <PriceHistory propertyId={p.id} />
        </div>
        <ContactPanel p={p} title={title} />
      </div>
      <SimilarHomes p={p} />
    </div>
  )
}

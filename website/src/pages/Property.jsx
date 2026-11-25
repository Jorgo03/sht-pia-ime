import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bath, BedDouble, Building, CalendarDays, ChevronLeft, ChevronRight, Mail, MapPin, MessageCircle, Phone, Ruler } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gradientFor } from '@/src/lib/format.js'
import { formatRef } from '@/src/features/properties/lib/searchFilters.js'
import { ErrorState } from '../components/States'
import NotFound from './NotFound'
import { getProperty } from '../lib/api'
import { cityName, getLocalizedText, listingBadgeKey, priceOf, priceSuffixKey, telUrl, titleOf, whatsappUrl } from '../lib/format'

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
        <img src={photos[i]} alt={t('web.gallery.count', { n: i + 1, total: photos.length })} decoding="async" />
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

function Contact({ p, title }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const phone = p.agent?.phone || p.contact_phone
  const suffix = priceSuffixKey(p.listing_type)
  const who = p.agent?.agency_name || p.agent?.full_name
  return (
    <aside className="contact" aria-labelledby="contact-title">
      <span className="badge is-inline">{t(listingBadgeKey(p.listing_type))}</span>
      <p className="contact-price">
        {priceOf(p, lang)}
        {suffix && <span className="card-suffix">{t(suffix)}</span>}
      </p>
      <h2 id="contact-title">{t('web.property.contactTitle')}</h2>
      {who && <p className="contact-who">{who}</p>}
      <div className="contact-actions">
        {phone && (
          <a className="btn btn-primary" href={telUrl(phone)}>
            <Phone size={18} aria-hidden="true" />
            {t('property.call')}
          </a>
        )}
        {phone && p.whatsapp_enabled !== false && (
          <a className="btn btn-outline" href={whatsappUrl(phone, t('property.whatsappMessage', { title }))} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {t('web.property.whatsapp')}
          </a>
        )}
        {p.contact_email && (
          <a className="btn btn-outline" href={`mailto:${p.contact_email}`}>
            <Mail size={18} aria-hidden="true" />
            {t('web.property.email')}
          </a>
        )}
      </div>
      {!phone && !p.contact_email && <p className="contact-note">{t('web.property.noContact')}</p>}
    </aside>
  )
}

export default function Property() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const q = useQuery({ queryKey: ['property', id], queryFn: () => getProperty(id) })
  const p = q.data
  const title = p ? titleOf(p, lang) : ''

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
          <Gallery photos={p.image_urls ?? []} title={title} id={p.id} />
          <header className="property-head">
            <h1>{title}</h1>
            {place && (
              <p className="card-place">
                <MapPin size={16} aria-hidden="true" />
                {place}
              </p>
            )}
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
          {hasMap && (
            <section aria-labelledby="map-title">
              <h2 id="map-title">{t('property.location')}</h2>
              <a
                className="text-link"
                href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin size={16} aria-hidden="true" />
                {t('web.property.openMap')}
              </a>
            </section>
          )}
        </div>
        <Contact p={p} title={title} />
      </div>
    </div>
  )
}

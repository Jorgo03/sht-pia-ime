import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Heart, Share2, MapPin, ExternalLink, ChevronRight as ChevRight, Globe, ArrowRight, Phone } from 'lucide-react'
import { useProperty, useProperties } from '../hooks/useProperties'
import { useTranslatedProperty } from '../hooks/useTranslatedProperty'
import { formatPrice, imageFor, listingBadgeKey, priceSuffixKey, telUrl, whatsappUrl } from '../../../lib/format'
import { useFavorites } from '../../favorites/FavoritesContext'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activity'
import { addRecentlyViewed } from '../hooks/useRecentlyViewed'
import PropertyCard from '../components/PropertyCard'
import ImageLightbox from '../components/ImageLightbox'
import ListingAssistant from '../components/ListingAssistant'
import ViewingRequestSheet from '../../viewings/components/ViewingRequestSheet'
import { isEnabled } from '../../../lib/flags'
import { useSwipe } from '../../../hooks/useSwipe'
import '../../../styles/property-detail.css'

const PropertyMap = lazy(() => import('../components/PropertyMap'))

export default function PropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { property, loading, error } = useProperty(id)
  const { user } = useAuth()
  const { isFavorite, toggle } = useFavorites()
  const [imgIdx, setImgIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [loginToast, setLoginToast] = useState(false)
  const [chatError, setChatError] = useState(false)
  const [viewingSheet, setViewingSheet] = useState(false)
  const [viewingToast, setViewingToast] = useState(false)
  const [brokenImages, setBrokenImages] = useState(new Set())
  const [shareToast, setShareToast] = useState(false)
  const { title, description, translating, isTranslated } = useTranslatedProperty(property, i18n.language)
  const { properties: similar } = useProperties({ filter: property?.property_type || 'all', city: property?.city || null, limit: 8 })
  const similarProperties = similar.filter(p => p.id !== id).slice(0, 4)
  const images = property?.image_urls?.length ? property.image_urls : []
  const swipe = useSwipe({
    onSwipeLeft: () => setImgIdx(i => (i + 1) % images.length),
    onSwipeRight: () => setImgIdx(i => (i - 1 + images.length) % images.length),
  })

  useEffect(() => {
    if (property?.id) { logActivity(property.id, 'view'); addRecentlyViewed(property.id) }
  }, [property?.id])

  useEffect(() => {
    if (title && property?.city) document.title = `${title} - ${property.city} | Shtëpia.ime`
    return () => { document.title = 'Shtëpia.ime' }
  }, [title, property?.city])

  if (loading) return <div className="page">{t('common.loading')}</div>
  // A localized message, never the driver's own text — see useProperty().
  if (error) return <div className="page" style={{ color: '#c0392b' }}>{t('errors.generic')}</div>
  // A deleted, sold-and-removed or mistyped listing: say so and offer a way on,
  // rather than a bare line of text with nowhere to go.
  if (!property) return (
    <div className="page mx-auto flex max-w-[420px] flex-col items-center px-5 pt-20 text-center">
      <h1 className="font-fho-serif text-2xl font-medium text-fho-text">{t('detail.unavailable')}</h1>
      <p className="mt-2 text-[15px] text-fho-text-muted">{t('detail.unavailableHint')}</p>
      <div className="mt-6 flex gap-3">
        <button className="pill-btn" onClick={() => navigate('/search')}>{t('common.search')}</button>
        <button className="pill-btn" onClick={() => navigate('/')}>{t('common.home')}</button>
      </div>
    </div>
  )

  const saved = isFavorite(property.id)
  const hasMultiple = images.length > 1
  const currentImg = images[imgIdx]
  const price = formatPrice(property.price, i18n.language, property.currency)
  const suffixKey = priceSuffixKey(property.listing_type)
  const suffix = suffixKey ? t(suffixKey) : ''
  const badge = t(listingBadgeKey(property.listing_type))
  const phone = property.contact_phone?.replace(/\s/g, '') || property.agent?.phone?.replace(/\s/g, '') || null
  const features = property.features || []
  const pricePerSqm = property.sqft > 0 ? Math.round(property.price / property.sqft) : null
  const propertyTypeLabel = property.property_type ? t(`search.${property.property_type}`) : ''

  const startChat = async () => {
    if (!user) { setLoginToast(true); setTimeout(() => setLoginToast(false), 2500); return }
    const recipientId = property.agent?.id || property.agent_id || property.owner_id
    if (!recipientId || recipientId === user.id) return
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('property_id', property.id)
      .eq('client_id', user.id)
      .eq('agent_id', recipientId)
      .maybeSingle()
    let conversationId = existing?.id
    if (!conversationId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ property_id: property.id, client_id: user.id, agent_id: recipientId })
        .select('id')
        .single()
      conversationId = created?.id
    }
    if (conversationId) {
      logActivity(property.id, 'message')
      navigate(`/messages?c=${conversationId}`)
    } else {
      setChatError(true)
      setTimeout(() => setChatError(false), 3000)
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) { navigator.share({ title, url }).catch(() => {}); return }
    try {
      await navigator.clipboard.writeText(url)
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2500)
    } catch { /* clipboard blocked (insecure context, permission) — nothing to confirm */ }
  }

  const handleFavorite = (e) => {
    e.stopPropagation()
    if (!user) { setLoginToast(true); setTimeout(() => setLoginToast(false), 2500); return }
    toggle(property.id)
  }

  return (
    <div className="detail-screen">
      {/* Photo hero */}
      <section
        className="detail-hero"
        onClick={() => images.length > 0 && setLightboxOpen(true)}
        onPointerDown={hasMultiple ? swipe.onPointerDown : undefined}
        onPointerUp={hasMultiple ? swipe.onPointerUp : undefined}
        onPointerCancel={hasMultiple ? swipe.onPointerCancel : undefined}
        style={hasMultiple ? swipe.style : undefined}
      >
        {currentImg && !brokenImages.has(currentImg) ? (
          <img className="detail-hero__img" src={currentImg} alt={title} decoding="async" draggable={false} onError={() => setBrokenImages(prev => new Set(prev).add(currentImg))} />
        ) : (
          <div className="detail-hero__img" style={{ background: imageFor(property) }} />
        )}
        <div className="detail-hero__chrome">
          <button className="round-btn" onClick={e => { e.stopPropagation(); navigate(-1) }} aria-label={t('common.back')}><ChevronLeft size={20} /></button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`round-btn ${saved ? 'saved' : ''}`} onClick={handleFavorite} aria-label={t('common.save')}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
            <button className="round-btn" onClick={e => { e.stopPropagation(); handleShare() }} aria-label={t('detail.share')}><Share2 size={18} /></button>
          </div>
        </div>
        {hasMultiple && (
          <>
            {/* Desktop-only click nav — mobile relies on the swipe gesture above. */}
            <button className="detail-hero__nav prev" onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length) }} aria-label={t('common.previous')}><ChevronLeft size={18} /></button>
            <button className="detail-hero__nav next" onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length) }} aria-label={t('common.next')}><ChevRight size={18} /></button>
          </>
        )}
        {hasMultiple && (
          images.length <= 8 ? (
            <div className="detail-hero__dots">
              {images.map((_, i) => (
                <span key={i} className={`dot ${i === imgIdx ? 'active' : ''}`} />
              ))}
            </div>
          ) : (
            <div className="detail-hero__counter">{imgIdx + 1} / {images.length}</div>
          )
        )}
      </section>

      {lightboxOpen && images.length > 0 && (
        <ImageLightbox images={images} index={imgIdx} onClose={() => setLightboxOpen(false)} onNavigate={dir => setImgIdx(i => (i + dir + images.length) % images.length)} />
      )}

      {/* Title section */}
      <section className="detail-title">
        <div className="screen-kicker"><span className="screen-kicker__dash" />{badge}{propertyTypeLabel ? ` · ${propertyTypeLabel}` : ''}</div>
        <h1 className="screen-headline">{title}</h1>
        <div className="muted-row"><MapPin size={14} /> {property.address}, {property.city}</div>
        <div className="detail-price">
          <span className="detail-price__main">{price}{suffix}</span>
          {pricePerSqm && <span className="detail-price__per">≈ {formatPrice(pricePerSqm, i18n.language, property.currency)}{t('detail.perSqm')}</span>}
        </div>
      </section>

      {/* Stats */}
      <section className="detail-stats">
        {property.beds > 0 && <div className="detail-stat"><span className="detail-stat__val">{property.beds}</span><span className="detail-stat__label">{t('detail.beds')}</span></div>}
        {property.baths > 0 && <div className="detail-stat"><span className="detail-stat__val">{property.baths}</span><span className="detail-stat__label">{t('detail.baths')}</span></div>}
        {property.sqft > 0 && <div className="detail-stat"><span className="detail-stat__val">{property.sqft} m²</span><span className="detail-stat__label">{t('detail.area')}</span></div>}
        {property.year_built && <div className="detail-stat"><span className="detail-stat__val">{property.year_built}</span><span className="detail-stat__label">{t('detail.year')}</span></div>}
      </section>

      {/* About */}
      <section className="detail-section">
        <h3 className="section-title__bare" style={{ padding: 0 }}>{t('detail.about')}</h3>
        {translating ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="pd-shimmer" /><div className="pd-shimmer" style={{ animationDelay: '0.15s' }} /><div className="pd-shimmer" style={{ animationDelay: '0.3s', width: '70%' }} />
          </div>
        ) : (
          <>
            <p className="about-copy">{description}</p>
            {isTranslated && <div className="pd-translated-badge"><Globe size={11} /> {t('property.autoTranslated')}</div>}
          </>
        )}
      </section>

      {/* Features */}
      {features.length > 0 && (
        <section className="detail-section">
          <h3 className="section-title__bare" style={{ padding: 0 }}>{t('detail.whatsInside')}</h3>
          <div className="features-grid">
            {features.map(f => <span key={f} className="feature-pill"><span className="feature-dot" />{t(`listing.feature.${f}`, f)}</span>)}
          </div>
        </section>
      )}

      {/* Contact — the agent, or the owner on a listing posted without one.
          Owner listings used to render nothing here, leaving no way to reach
          them. The strip itself isn't clickable: only the agent's name links
          to the profile, so no button sits inside another interactive element. */}
      {(property.agent || phone) && (
        <section className="agent-strip">
          {property.agent ? (
            <button type="button" className="agent-strip__who" onClick={() => navigate(`/agent/${property.agent.id}`)}>
              <span className="agent-initial">{property.agent.full_name?.[0] || 'A'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="agent-name">{property.agent.full_name}</span>
                <span className="agent-agency">{property.agent.agency_name}</span>
              </span>
            </button>
          ) : (
            <div className="agent-strip__who">
              <span className="agent-initial">{t('detail.owner')[0]}</span>
              <span className="agent-name" style={{ flex: 1 }}>{t('detail.owner')}</span>
            </div>
          )}
          <div className="agent-strip__actions">
            <button className="pill-btn" onClick={startChat}>
              {t('detail.chatInApp')}
            </button>
            {phone && (
              <a className="pill-btn" href={telUrl(phone)} aria-label={t('property.call')} onClick={() => logActivity(property.id, 'call')}>
                <Phone size={14} aria-hidden="true" />
              </a>
            )}
            {phone && (
              <a
                className="pill-btn"
                href={whatsappUrl(phone, t('property.whatsappMessage', { title }))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logActivity(property.id, 'message')}
              >
                {t('detail.message')}
              </a>
            )}
          </div>
        </section>
      )}

      {/* Map */}
      {property.latitude && property.longitude && (
        <section className="detail-section">
          <Suspense fallback={<div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>}>
            <PropertyMap lat={property.latitude} lng={property.longitude} />
          </Suspense>
          <a href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`} target="_blank" rel="noopener noreferrer" className="pd-map-link">
            <ExternalLink size={14} /> {t('map.openInMaps')}
          </a>
        </section>
      )}

      {/* Similar */}
      {similarProperties.length > 0 && (
        <section className="detail-section">
          <h3 className="section-title__bare" style={{ padding: 0 }}>{t('property.similar')}</h3>
          <div className="h-scroll snap-x" style={{ padding: 0 }}>
            {similarProperties.map(p => <PropertyCard key={p.id} property={p} variant="compact" />)}
          </div>
        </section>
      )}

      {/* Sticky CTA — in-app viewing request (owner sees no CTA on own listing) */}
      {user?.id !== property.owner_id && user?.id !== property.agent_id && (
        <section className="detail-cta">
          <button
            className="cta-pill"
            onClick={() => {
              if (!user) { setLoginToast(true); setTimeout(() => setLoginToast(false), 2500); return }
              setViewingSheet(true)
            }}
          >
            {t('detail.scheduleViewing')} <ArrowRight size={18} />
          </button>
        </section>
      )}

      {viewingSheet && (
        <ViewingRequestSheet
          property={property}
          onClose={() => setViewingSheet(false)}
          onDone={() => {
            setViewingSheet(false)
            setViewingToast(true)
            setTimeout(() => setViewingToast(false), 3000)
          }}
        />
      )}

      {viewingToast && (
        <div className="addsheet-toast" role="status" onClick={() => setViewingToast(false)}>{t('viewings.requestSuccess')}</div>
      )}

      {shareToast && (
        <div className="addsheet-toast" role="status" onClick={() => setShareToast(false)}>{t('detail.linkCopied')}</div>
      )}

      {loginToast && (
        <div className="addsheet-toast" onClick={() => navigate('/profile')}>{t('favourites.loginPrompt')}</div>
      )}
      {chatError && (
        <div className="addsheet-toast" role="alert" onClick={() => setChatError(false)}>{t('errors.generic')}</div>
      )}

      {isEnabled('aiAssistant') && property.status === 'active' && (
        <ListingAssistant property={property} />
      )}
    </div>
  )
}

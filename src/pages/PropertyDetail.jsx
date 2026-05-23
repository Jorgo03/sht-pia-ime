import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Heart, Bed, Bath, Ruler, MapPin, Phone, MessageCircle, ExternalLink, ChevronLeft, ChevronRight, Globe, Share2 } from 'lucide-react'
import { useProperty, useProperties } from '../hooks/useProperties'
import { useTranslatedProperty } from '../hooks/useTranslatedProperty'
import { formatPrice, imageFor } from '../lib/format'
import { useFavorites } from '../contexts/FavoritesContext'
import { useAuth } from '../contexts/AuthContext'
import { logActivity } from '../lib/activity'
import { addRecentlyViewed } from '../hooks/useRecentlyViewed'
import PropertyCard from '../components/PropertyCard'
import ImageLightbox from '../components/ImageLightbox'
import '../styles/property-detail.css'

const PropertyMap = lazy(() => import('../components/PropertyMap'))
const FloorPlanViewer = import.meta.env.VITE_FEATURE_3D_FLOORPLAN === 'true'
  ? lazy(() => import('../components/floorplan/FloorPlanViewer'))
  : null

function getVideoEmbedUrl(url) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  return null
}

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
  const [brokenImages, setBrokenImages] = useState(new Set())
  const { title, description, translating, isTranslated } = useTranslatedProperty(property, i18n.language)
  const { properties: similar } = useProperties({
    filter: property?.property_type || 'all',
    city: property?.city || null,
  })
  const similarProperties = similar.filter(p => p.id !== id).slice(0, 4)

  useEffect(() => {
    if (property?.id) {
      logActivity(property.id, 'view')
      addRecentlyViewed(property.id)
    }
  }, [property?.id])

  useEffect(() => {
    if (title && property?.city) {
      document.title = `${title} - ${property.city} | Shtëpia.ime`
    }
    return () => { document.title = 'Shtëpia.ime' }
  }, [title, property?.city])

  if (loading) return <div className="page">{t('common.loading')}</div>
  if (error) return <div className="page" style={{ color: '#c0392b' }}>{t('common.error')}: {error}</div>
  if (!property) return <div className="page">{t('search.empty')}</div>

  const saved = isFavorite(property.id)
  const images = property.image_urls?.length ? property.image_urls : []
  const hasMultiple = images.length > 1

  const currentImg = images[imgIdx]
  const heroBg = currentImg && !brokenImages.has(currentImg)
    ? { backgroundImage: `url(${currentImg})` }
    : { background: imageFor(property) }

  const price = formatPrice(property.price, i18n.language)
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : ''

  const phone = property.contact_phone?.replace(/\s/g, '') || property.agent?.phone?.replace(/\s/g, '') || '355691234567'
  const waMsg = encodeURIComponent(t('property.whatsappMessage', { title }))
  const videoEmbed = getVideoEmbedUrl(property.video_url)

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  const handleFavorite = (e) => {
    e.stopPropagation()
    if (!user) {
      setLoginToast(true)
      setTimeout(() => setLoginToast(false), 2500)
      return
    }
    toggle(property.id)
  }

  return (
    <div>
      <div className="pd-hero" style={heroBg} onClick={() => images.length > 0 && setLightboxOpen(true)}>
        {currentImg && !brokenImages.has(currentImg) && (
          <img
            src={currentImg}
            alt=""
            onError={() => setBrokenImages(prev => new Set(prev).add(currentImg))}
            style={{ display: 'none' }}
          />
        )}
        <button className="pd-hero-btn pd-back" onClick={e => { e.stopPropagation(); navigate(-1) }} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="pd-actions">
          <button className="pd-hero-btn" onClick={e => { e.stopPropagation(); handleShare() }} aria-label="Share">
            <Share2 size={18} />
          </button>
          <button className={`pd-hero-btn ${saved ? 'saved' : ''}`} onClick={handleFavorite} aria-label={t('common.save')}>
            <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        {hasMultiple && (
          <>
            <button className="pd-nav pd-nav-prev" onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length) }} aria-label="Previous">
              <ChevronLeft size={20} />
            </button>
            <button className="pd-nav pd-nav-next" onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length) }} aria-label="Next">
              <ChevronRight size={20} />
            </button>
            <div className="pd-counter">{imgIdx + 1} / {images.length}</div>
          </>
        )}
      </div>

      {lightboxOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={imgIdx}
          onClose={() => setLightboxOpen(false)}
          onNavigate={dir => setImgIdx(i => (i + dir + images.length) % images.length)}
        />
      )}

      <div className="pd-body">
        <div className="pd-header">
          <div>
            <div className="pd-title">{title}</div>
            <div className="pd-address">
              <MapPin size={12} /> {property.address}, {property.city}
            </div>
          </div>
          <div className="pd-price">{price}{suffix}</div>
        </div>

        <div className="pd-specs">
          {property.beds > 0 && (
            <div className="pd-spec">
              <Bed size={18} style={{ color: 'var(--fho-text-muted)' }} />
              <div className="pd-spec-value">{property.beds}</div>
              <div className="pd-spec-label">{t('property.beds')}</div>
            </div>
          )}
          <div className="pd-spec">
            <Bath size={18} style={{ color: 'var(--fho-text-muted)' }} />
            <div className="pd-spec-value">{property.baths}</div>
            <div className="pd-spec-label">{t('property.baths')}</div>
          </div>
          <div className="pd-spec">
            <Ruler size={18} style={{ color: 'var(--fho-text-muted)' }} />
            <div className="pd-spec-value">{property.sqft}</div>
            <div className="pd-spec-label">{t('property.sqft')}</div>
          </div>
        </div>

        <div className="pd-card">
          {translating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="pd-shimmer" />
              <div className="pd-shimmer" style={{ animationDelay: '0.15s' }} />
              <div className="pd-shimmer" style={{ animationDelay: '0.3s', width: '70%' }} />
            </div>
          ) : (
            <>
              <div className="pd-description">{description}</div>
              {isTranslated && (
                <div className="pd-translated-badge">
                  <Globe size={11} /> {t('property.autoTranslated')}
                </div>
              )}
            </>
          )}
        </div>

        {property.agent && (
          <div className="pd-card pd-agent" onClick={() => navigate(`/agent/${property.agent.id}`)}>
            <div className="pd-agent-avatar">
              {property.agent.full_name?.[0] || 'F'}
            </div>
            <div style={{ flex: 1 }}>
              <div className="pd-agent-name">{property.agent.full_name}</div>
              <div className="pd-agent-agency">{property.agent.agency_name}</div>
            </div>
          </div>
        )}

        <div className="pd-contact">
          <a href={`tel:${phone}`} onClick={() => logActivity(property.id, 'call')} className="pd-contact-btn pd-contact-call">
            <Phone size={16} /> {t('property.call')}
          </a>
          <a href={`https://wa.me/${phone}?text=${waMsg}`} target="_blank" rel="noopener noreferrer" onClick={() => logActivity(property.id, 'message')} className="pd-contact-btn pd-contact-wa">
            <MessageCircle size={16} /> WhatsApp
          </a>
        </div>

        {videoEmbed && (
          <div className="pd-video">
            <div className="pd-section-title">{t('property.video')}</div>
            <iframe src={videoEmbed} title="Property video" allowFullScreen />
          </div>
        )}

        {property.latitude && property.longitude && (
          <div style={{ marginTop: 16 }}>
            <Suspense fallback={<div className="pd-card" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>}>
              <PropertyMap lat={property.latitude} lng={property.longitude} />
            </Suspense>
            <a href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`} target="_blank" rel="noopener noreferrer" className="pd-map-link">
              <ExternalLink size={14} /> {t('map.openInMaps')}
            </a>
          </div>
        )}

        {FloorPlanViewer && property.floor_plan && (
          <div style={{ marginTop: 16 }}>
            <div className="pd-section-title">{t('floorPlan.title')}</div>
            <Suspense fallback={<div className="pd-card" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>}>
              <FloorPlanViewer plan={property.floor_plan} />
            </Suspense>
          </div>
        )}

        {similarProperties.length > 0 && (
          <div className="pd-similar">
            <div className="pd-section-title">{t('property.similar')}</div>
            <div className="property-grid">
              {similarProperties.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          </div>
        )}
      </div>

      {loginToast && (
        <div className="pd-login-toast" onClick={() => navigate('/profile')}>
          {t('favourites.loginPrompt')}
        </div>
      )}
    </div>
  )
}

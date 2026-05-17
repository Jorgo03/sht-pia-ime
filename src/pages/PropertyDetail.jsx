import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Heart, Bed, Bath, Ruler, MapPin, Phone, MessageCircle } from 'lucide-react'
import { useProperty } from '../hooks/useProperties'
import { formatPrice, imageFor } from '../lib/format'
import { useFavorites } from '../contexts/FavoritesContext'

export default function PropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { property, loading, error } = useProperty(id)
  const { isFavorite, toggle } = useFavorites()

  if (loading) return <div className="page">{t('common.loading')}</div>
  if (error)   return <div className="page" style={{color:'#c0392b'}}>{t('common.error')}: {error}</div>
  if (!property) return <div className="page">{t('search.empty')}</div>

  const saved = isFavorite(property.id)

  const heroBg = property.image_urls?.[0]
    ? { backgroundImage: `url(${property.image_urls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: imageFor(property) }

  const price = formatPrice(property.price, i18n.language)
  const suffix = property.listing_type === 'rent' ? t('property.perMonth') : ''

  const phone = property.agent?.phone?.replace(/\s/g, '') || '355691234567'
  const waMsg = encodeURIComponent(`Hello, I'm interested in "${property.title}".`)

  return (
    <div>
      <div style={{ ...heroBg, height: 280, position: 'relative', borderRadius: '0 0 24px 24px', overflow: 'hidden' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          style={{
            position: 'absolute', top: 16, left: 16, width: 40, height: 40,
            borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: 'none', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer'
          }}
        ><ArrowLeft size={20} /></button>
        <button
          onClick={(e) => { e.stopPropagation(); toggle(property.id) }}
          aria-label={t('common.save')}
          style={{
            position: 'absolute', top: 16, right: 16, width: 40, height: 40,
            borderRadius: '50%', background: saved ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: 'none', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
            color: saved ? 'var(--fho-orange-2)' : 'inherit'
          }}
        ><Heart size={20} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>

      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{property.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fho-text-muted)', fontSize: 13, marginTop: 4 }}>
              <MapPin size={12} /> {property.address}, {property.city}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--fho-orange-2)' }}>
            {price}{suffix}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          {property.beds > 0 && (
            <div style={{ flex: 1, background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 12, textAlign: 'center', border: '0.5px solid var(--fho-border)' }}>
              <Bed size={18} style={{ color: 'var(--fho-text-muted)' }} />
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{property.beds}</div>
              <div style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{t('property.beds')}</div>
            </div>
          )}
          <div style={{ flex: 1, background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 12, textAlign: 'center', border: '0.5px solid var(--fho-border)' }}>
            <Bath size={18} style={{ color: 'var(--fho-text-muted)' }} />
            <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{property.baths}</div>
            <div style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{t('property.baths')}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 12, textAlign: 'center', border: '0.5px solid var(--fho-border)' }}>
            <Ruler size={18} style={{ color: 'var(--fho-text-muted)' }} />
            <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{property.sqft}</div>
            <div style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{t('property.sqft')}</div>
          </div>
        </div>

        <div style={{ background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 16, border: '0.5px solid var(--fho-border)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{property.description}</div>
        </div>

        {property.agent && (
          <div style={{ background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 14, border: '0.5px solid var(--fho-border)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--fho-orange-1), var(--fho-orange-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
              {property.agent.full_name?.[0] || 'F'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{property.agent.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--fho-text-muted)' }}>{property.agent.agency_name}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`tel:${phone}`}
            style={{ flex: 1, background: 'var(--fho-surface)', border: '0.5px solid var(--fho-border)', borderRadius: 'var(--r-md)', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 500, color: 'var(--fho-text)', textDecoration: 'none', fontSize: 14 }}
          ><Phone size={16} /> WhatsApp</a>
          <a
            href={`https://wa.me/${phone}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, background: 'linear-gradient(135deg, var(--fho-orange-1), var(--fho-orange-2))', borderRadius: 'var(--r-md)', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 500, color: 'white', textDecoration: 'none', fontSize: 14, boxShadow: '0 4px 12px rgba(232,93,44,0.3)' }}
          ><MessageCircle size={16} /> WhatsApp</a>
        </div>
      </div>
    </div>
  )
}

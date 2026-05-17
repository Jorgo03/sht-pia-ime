import { useState } from 'react'
import { MapPin, ChevronDown, Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FeaturedCard from '../components/FeaturedCard'
import PropertyCard from '../components/PropertyCard'
import SkeletonCard from '../components/SkeletonCard'
import { useProperties } from '../hooks/useProperties'
import '../styles/home.css'

export default function Home() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()
  const { properties, loading, error } = useProperties({ filter })

  const FILTERS = [
    { id: 'all',        label: t('common.all') },
    { id: 'apartment',  label: t('search.apartment') },
    { id: 'house',      label: t('search.villa') },
    { id: 'commercial', label: t('search.commercial') },
  ]

  const featured = properties[0]
  const others = properties.slice(1)

  return (
    <div>
      <div className="home-header">
        <div>
          <div className="loc-label"><MapPin size={12} /> {t('search.location')}</div>
          <div className="loc-name">Tiranë <ChevronDown size={14} /></div>
        </div>
        <div className="avatar" onClick={() => navigate('/profile')}>FHO</div>
      </div>

      <div className="search-bar" onClick={() => navigate('/search')}>
        <SearchIcon size={16} />
        <span style={{ flex: 1 }}>{t('search.placeholder')}</span>
        <SlidersHorizontal size={16} className="filter-icon" />
      </div>

      <div className="chips-row">
        {FILTERS.map(f => (
          <div
            key={f.id}
            className={`chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >{f.label}</div>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '0 1.25rem' }}>
          <div className="property-grid" style={{ padding: 0 }}>
            {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {error && (
        <div className="placeholder-card" style={{ margin: '0 1.25rem' }}>
          {t('common.error')}: {error}
        </div>
      )}

      {!loading && !error && properties.length === 0 && (
        <div className="placeholder-card" style={{ margin: '0 1.25rem' }}>
          {t('search.empty')}
        </div>
      )}

      {!loading && featured && <FeaturedCard property={featured} />}

      {others.length > 0 && (
        <>
          <div className="section-title">
            <h2>{t('common.nearYou')}</h2>
            <a onClick={() => navigate('/search')}>{t('common.viewAll')}</a>
          </div>
          <div className="property-grid">
            {others.map(p => <PropertyCard key={p.id} property={p} />)}
          </div>
        </>
      )}
    </div>
  )
}

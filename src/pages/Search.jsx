import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, X } from 'lucide-react'
import PropertyCard from '../components/PropertyCard'
import SkeletonCard from '../components/SkeletonCard'
import { useProperties } from '../hooks/useProperties'
import '../styles/search.css'

const LOCATIONS = [
  'Blloku',
  'Liqeni i Thatë',
  'Myslym Shyri',
  'Selvia',
  'Ali Dem',
  'Komuna e Parisit',
  '21 Dhjetori',
  'Ish-Blloku',
  'Kombinat',
  'Laprakë',
  'Medreseja',
]

const PROPERTY_TYPES = ['apartment', 'house', 'commercial', 'land']
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5]

export default function Search() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(true)

  const location = searchParams.get('location') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const beds = searchParams.get('beds') || ''
  const propertyType = searchParams.get('type') || ''
  const listingType = searchParams.get('listing') || ''

  const { properties, loading, error } = useProperties({
    filter: propertyType || 'all',
    listingType: listingType || null,
    city: location || null,
    minPrice: minPrice ? Number(minPrice) : null,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    beds: beds ? Number(beds) : null,
  })

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const resetFilters = () => setSearchParams({}, { replace: true })

  const hasFilters = location || minPrice || maxPrice || beds || propertyType || listingType

  return (
    <div className="page search-page">
      <h1 className="page-title">{t('search.title')}</h1>
      <p className="page-subtitle">{t('search.subtitle')}</p>

      <div className="filters-section">
        <button className="filters-toggle" onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={16} />
          <span>{t('search.filters')}</span>
        </button>

        {showFilters && (
          <div className="filters-grid">
            <div className="filter-group">
              <label>{t('search.location')}</label>
              <select value={location} onChange={e => updateFilter('location', e.target.value)}>
                <option value="">{t('search.anyLocation')}</option>
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>{t('search.listingType')}</label>
              <select value={listingType} onChange={e => updateFilter('listing', e.target.value)}>
                <option value="">{t('search.anyType')}</option>
                <option value="sale">{t('search.sale')}</option>
                <option value="rent">{t('search.rent')}</option>
              </select>
            </div>

            <div className="filter-group">
              <label>{t('search.propertyType')}</label>
              <select value={propertyType} onChange={e => updateFilter('type', e.target.value)}>
                <option value="">{t('search.anyType')}</option>
                {PROPERTY_TYPES.map(type => (
                  <option key={type} value={type}>{t(`search.${type}`)}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>{t('search.bedrooms')}</label>
              <select value={beds} onChange={e => updateFilter('beds', e.target.value)}>
                <option value="">{t('search.anyBeds')}</option>
                {BEDROOM_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}+</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>{t('search.minPrice')}</label>
              <input
                type="number"
                placeholder="€0"
                value={minPrice}
                onChange={e => updateFilter('minPrice', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>{t('search.maxPrice')}</label>
              <input
                type="number"
                placeholder="€∞"
                value={maxPrice}
                onChange={e => updateFilter('maxPrice', e.target.value)}
              />
            </div>

            {hasFilters && (
              <button className="reset-btn" onClick={resetFilters}>
                <X size={14} />
                {t('search.reset')}
              </button>
            )}
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="results-count">
          {t('search.results', { count: properties.length })}
        </div>
      )}

      {loading ? (
        <div className="property-grid">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="placeholder-card">
          <div style={{ color: '#c0392b' }}>{t('errors.generic')}</div>
        </div>
      ) : properties.length === 0 ? (
        <div className="placeholder-card empty-state">
          <div className="icon" style={{ fontSize: 32 }}>🏠</div>
          <div>{t('search.empty')}</div>
        </div>
      ) : (
        <div className="property-grid">
          {properties.map(p => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  )
}

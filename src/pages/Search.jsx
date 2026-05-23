import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, LayoutGrid, Map as MapIcon, RotateCcw, SearchX } from 'lucide-react'
import PropertyCard from '../components/PropertyCard'
import PropertyMap from '../components/PropertyMap'
import SkeletonCard from '../components/SkeletonCard'
import CustomDropdown from '../components/CustomDropdown'
import { useProperties } from '../hooks/useProperties'
import LOCATIONS from '../data/locations'

const CITY_OPTIONS = [
  { value: '', label: 'Any city' },
  ...['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Elbasan', 'Fier', 'Korçë',
    'Berat', 'Lushnjë', 'Pogradec', 'Kavajë', 'Lezhë', 'Gjirokastër',
    'Sarandë', 'Kukës', 'Peshkopi', 'Krujë', 'Laç', 'Burrel',
  ].map(c => ({ value: c, label: c })),
]
import '../styles/search.css'

const PROPERTY_TYPES = ['apartment', 'villa', 'land', 'office']
const EUR_ALL_RATE = 107

export default function Search() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currency, setCurrency] = useState('EUR')
  const [viewMode, setViewMode] = useState('list')

  const city = searchParams.get('city') || ''
  const zone = searchParams.get('zone') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const propertyType = searchParams.get('type') || ''

  const selectedCity = LOCATIONS.find(l => l.city === city)
  const location = zone || city

  const queryMinPrice = useMemo(() => {
    if (!minPrice) return null
    const v = Number(minPrice)
    return currency === 'ALL' ? Math.round(v / EUR_ALL_RATE) : v
  }, [minPrice, currency])

  const queryMaxPrice = useMemo(() => {
    if (!maxPrice) return null
    const v = Number(maxPrice)
    return currency === 'ALL' ? Math.round(v / EUR_ALL_RATE) : v
  }, [maxPrice, currency])

  const { properties, loading, error } = useProperties({
    filter: propertyType || 'all',
    city: location || null,
    minPrice: queryMinPrice,
    maxPrice: queryMaxPrice,
  })

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const handleCityChange = (value) => {
    const params = new URLSearchParams(searchParams)
    params.delete('zone')
    if (value) params.set('city', value)
    else params.delete('city')
    setSearchParams(params, { replace: true })
  }

  const resetFilters = () => setSearchParams({}, { replace: true })
  const hasFilters = city || zone || minPrice || maxPrice || propertyType

  return (
    <div className="page search-page">
      <h1 className="page-title">{t('search.title')}</h1>
      <p className="page-subtitle">{t('search.subtitle')}</p>

      <div className="location-selects">
        <CustomDropdown
          label={t('search.city')}
          value={city}
          options={CITY_OPTIONS}
          placeholder={t('search.anyCity')}
          onChange={handleCityChange}
        />
        {selectedCity && (
          <CustomDropdown
            label={t('search.neighborhood')}
            value={zone}
            options={[
              { value: '', label: t('search.anyZone') },
              ...selectedCity.zones.map(z => ({ value: z, label: z })),
            ]}
            placeholder={t('search.anyZone')}
            onChange={v => updateFilter('zone', v)}
          />
        )}
      </div>

      <div className="type-chips">
        <button
          className={`type-chip ${!propertyType ? 'active' : ''}`}
          onClick={() => updateFilter('type', '')}
        >{t('common.all')}</button>
        {PROPERTY_TYPES.map(type => (
          <button
            key={type}
            className={`type-chip ${propertyType === type ? 'active' : ''}`}
            onClick={() => updateFilter('type', propertyType === type ? '' : type)}
          >{t(`search.${type}`)}</button>
        ))}
      </div>

      <div className="price-range">
        <label>{t('search.priceRange')}</label>
        <div className="price-inputs">
          <div className="price-field">
            <span className="price-unit">{currency === 'EUR' ? '€' : 'L'}</span>
            <input
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={e => updateFilter('minPrice', e.target.value)}
            />
          </div>
          <span className="price-separator">—</span>
          <div className="price-field">
            <span className="price-unit">{currency === 'EUR' ? '€' : 'L'}</span>
            <input
              type="number"
              placeholder={currency === 'EUR' ? '1,000,000' : '107,000,000'}
              value={maxPrice}
              onChange={e => updateFilter('maxPrice', e.target.value)}
            />
          </div>
          <button
            className="currency-toggle"
            onClick={() => setCurrency(c => c === 'EUR' ? 'ALL' : 'EUR')}
          >{currency}</button>
        </div>
      </div>

      {hasFilters && (
        <button className="search-reset-btn" onClick={resetFilters}>
          <X size={14} />
          {t('search.reset')}
        </button>
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="results-count" style={{ marginBottom: 0 }}>
            {t('search.results', { count: properties.length })}
          </div>
          <div className="view-toggle">
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              <LayoutGrid size={14} /> List
            </button>
            <button
              className={viewMode === 'map' ? 'active' : ''}
              onClick={() => setViewMode('map')}
            >
              <MapIcon size={14} /> Map
            </button>
          </div>
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
        <div className="empty-state">
          <SearchX size={40} className="empty-state-icon" />
          <div className="empty-state-title">{t('search.empty')}</div>
          <div className="empty-state-sub">{t('search.emptyHint')}</div>
          {hasFilters && (
            <button className="empty-reset-btn" onClick={resetFilters}>
              <RotateCcw size={14} />
              {t('search.reset')}
            </button>
          )}
        </div>
      ) : viewMode === 'map' ? (
        <PropertyMap properties={properties} />
      ) : (
        <div className="property-grid">
          {properties.map(p => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  )
}

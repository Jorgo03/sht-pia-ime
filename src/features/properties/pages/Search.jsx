import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search as SearchIcon, SlidersHorizontal, LayoutGrid, Map as MapIcon, RotateCcw, SearchX, X, Sparkles } from 'lucide-react'
import { parseSearchQuery } from '../../../lib/ai'
import { isEnabled } from '../../../lib/flags'
import PropertyCard from '../components/PropertyCard'
import PropertyMap from '../components/PropertyMap'
import SkeletonCard from '../../../shared/SkeletonCard'
import { useProperties } from '../hooks/useProperties'
import '../../../styles/search.css'

const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'land', 'office']
const BED_OPTIONS = [null, 1, 2, 3, 4]

function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const id = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(id) }, [value, delay])
  return debounced
}

export default function Search() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('list')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [aiParsing, setAiParsing] = useState(false)
  const [aiStatus, setAiStatus] = useState(null) // 'applied' | 'failed'

  const city = searchParams.get('city') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const propertyType = searchParams.get('type') || ''
  const listingType = searchParams.get('listing') || ''
  const beds = searchParams.get('beds') || ''
  const sort = searchParams.get('sort') || 'newest'

  const debouncedMin = useDebounced(minPrice)
  const debouncedMax = useDebounced(maxPrice)
  const debouncedSearch = useDebounced(searchText)

  const queryMin = useMemo(() => debouncedMin ? Number(debouncedMin) : null, [debouncedMin])
  const queryMax = useMemo(() => debouncedMax ? Number(debouncedMax) : null, [debouncedMax])

  const { properties, loading, loadingMore, hasMore, loadMore } = useProperties({
    filter: propertyType || 'all',
    listingType: listingType || null,
    city: debouncedSearch || city || null,
    minPrice: queryMin,
    maxPrice: queryMax,
    beds: beds ? Number(beds) : null,
    paginate: true,
    sort,
  })

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const resetFilters = () => { setSearchParams({}, { replace: true }); setSearchText(''); setAiStatus(null) }

  // Feature B — parse a natural-language query into the existing URL filters.
  // On failure the typed text keeps working as the normal city search.
  const handleAiSearch = async () => {
    if (!searchText.trim() || aiParsing) return
    setAiParsing(true)
    setAiStatus(null)
    const filters = await parseSearchQuery(searchText)
    setAiParsing(false)
    if (!filters) {
      setAiStatus('failed')
      setTimeout(() => setAiStatus(null), 3000)
      return
    }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) params.set(k, v)
    setSearchParams(params, { replace: true })
    setSearchText('')
    setAiStatus('applied')
    setTimeout(() => setAiStatus(null), 3000)
  }
  const activeCount = [city, minPrice, maxPrice, propertyType, listingType, beds].filter(Boolean).length

  useEffect(() => {
    if (!filtersOpen) return
    const h = (e) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [filtersOpen])

  return (
    <div className="search-screen">
      <div className="search-head">
        <div className="search-head__row">
          <h1 className="screen-headline">{t('search.headline')} <em>{t('search.headlineEm')}</em>.</h1>
          <div className="view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label={t('search.listView')} aria-pressed={viewMode === 'list'}><LayoutGrid size={14} /></button>
            <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')} aria-label={t('search.mapView')} aria-pressed={viewMode === 'map'}><MapIcon size={14} /></button>
          </div>
        </div>
        <div className="search-controls">
          <div className="search-field">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder={isEnabled('aiSearch') ? t('search.aiPlaceholder') : t('search.placeholder')}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isEnabled('aiSearch') && handleAiSearch()}
            />
            {isEnabled('aiSearch') && searchText.trim() && (
              <button
                className="ai-search-btn"
                onClick={handleAiSearch}
                disabled={aiParsing}
                title={t('search.aiButton')}
                aria-label={t('search.aiButton')}
              >
                <Sparkles size={15} className={aiParsing ? 'ai-spin' : ''} />
              </button>
            )}
          </div>
          <button className="filter-btn" onClick={() => setFiltersOpen(true)} aria-label={t('search.filtersTitle')}>
            <SlidersHorizontal size={16} />
            {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
          </button>
        </div>
        {aiStatus && (
          <div className="ai-search-status">
            <Sparkles size={12} />
            {aiStatus === 'applied' ? t('search.aiApplied') : t('search.aiFailed')}
          </div>
        )}
      </div>

      <div className="result-count">
        <span><strong>{properties.length}</strong> {t('search.homesInView')}</span>
        <span className="mono-eyebrow">{viewMode === 'map' ? t('search.mapView') : t('search.sortedByRelevance')}</span>
      </div>

      {loading ? (
        <div className="property-grid" style={{ padding: '0 1.25rem' }}>
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <SearchX size={40} className="empty-state-icon" />
          <div className="empty-state-title">{t('search.empty')}</div>
          <div className="empty-state-sub">{t('search.emptyHint')}</div>
          {activeCount > 0 && <button className="empty-reset-btn" onClick={resetFilters}><RotateCcw size={14} /> {t('search.reset')}</button>}
        </div>
      ) : viewMode === 'map' ? (
        <div style={{ padding: '0 1.25rem' }}><PropertyMap properties={properties} /></div>
      ) : (
        <div style={{ padding: '0 1.25rem' }}>
          <div className="property-grid" style={{ padding: 0 }}>
            {properties.map(p => <PropertyCard key={p.id} property={p} />)}
          </div>
          {hasMore && (
            <button className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t('common.loading') : t('common.viewAll')}
            </button>
          )}
        </div>
      )}

      {/* Filter bottom sheet */}
      {filtersOpen && (
        <>
          <div className="filter-backdrop" onClick={() => setFiltersOpen(false)} />
          <div className="filter-sheet">
            <div className="addsheet-grip" />
            <div className="filter-sheet__header">
              <h2 className="filter-sheet__title">{t('search.filtersTitle')}</h2>
              <button className="link-btn" onClick={resetFilters} style={{ color: 'var(--fho-orange-1)' }}>{t('search.reset')}</button>
            </div>

            {/* Listing type */}
            <div className="filter-section">
              <label className="filter-label">{t('search.listingType')}</label>
              <div className="segment-control">
                {['', 'sale', 'rent'].map(lt => (
                  <button key={lt} className={`segment ${listingType === lt ? 'active' : ''}`} onClick={() => updateFilter('listing', lt)}>
                    {lt === '' ? t('common.all') : t(`listing.type.${lt}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div className="filter-section">
              <label className="filter-label">{t('search.priceRange')}</label>
              <div className="price-display">
                <span className="price-val">€{minPrice || '50,000'}</span>
                <span className="price-sep">—</span>
                <span className="price-val">€{maxPrice || '800,000'}</span>
              </div>
              <div className="dual-slider">
                <input type="range" className="dual" min="50000" max="800000" step="10000" value={minPrice || 50000} onChange={e => updateFilter('minPrice', e.target.value)} />
                <input type="range" className="dual" min="50000" max="800000" step="10000" value={maxPrice || 800000} onChange={e => updateFilter('maxPrice', e.target.value)} />
                <div className="slider-track">
                  <div className="slider-fill" style={{ left: `${((Number(minPrice || 50000) - 50000) / 750000) * 100}%`, right: `${100 - ((Number(maxPrice || 800000) - 50000) / 750000) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Bedrooms */}
            <div className="filter-section">
              <label className="filter-label">{t('search.bedrooms')}</label>
              <div className="bed-chips">
                {BED_OPTIONS.map(b => (
                  <button key={b ?? 'any'} className={`bed-chip ${(beds === '' && b === null) || beds === String(b) ? 'active' : ''}`}
                    onClick={() => updateFilter('beds', b === null ? '' : String(b))}>
                    {b === null ? t('search.anyBeds') : b === 4 ? '4+' : b}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="filter-section">
              <label className="filter-label">{t('search.sortLabel')}</label>
              <div className="segment-control">
                {['newest', 'price_asc', 'price_desc'].map(s => (
                  <button key={s} className={`segment ${sort === s ? 'active' : ''}`} onClick={() => updateFilter('sort', s === 'newest' ? '' : s)}>
                    {t(`search.sort.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Property type */}
            <div className="filter-section">
              <label className="filter-label">{t('search.propertyType')}</label>
              <div className="bed-chips">
                <button className={`bed-chip ${!propertyType ? 'active' : ''}`} onClick={() => updateFilter('type', '')}>{t('common.all')}</button>
                {PROPERTY_TYPES.map(pt => (
                  <button key={pt} className={`bed-chip ${propertyType === pt ? 'active' : ''}`} onClick={() => updateFilter('type', pt)}>{t(`search.${pt}`)}</button>
                ))}
              </div>
            </div>

            <button className="cta-pill" onClick={() => setFiltersOpen(false)}>
              {t('search.showHomes', { count: properties.length })}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

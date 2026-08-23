import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search as SearchIcon, SlidersHorizontal, LayoutGrid, Map as MapIcon, RotateCcw, SearchX, Sparkles, Maximize2, AlertCircle, MapPin } from 'lucide-react'
import { parseSearchQuery } from '../../../lib/ai'
import { isEnabled } from '../../../lib/flags'
import PropertyCard from '../components/PropertyCard'
import PropertyMap from '../components/PropertyMap'
import FilterBar from '../components/FilterBar'
import SkeletonCard from '../../../shared/SkeletonCard'
import { useProperties } from '../hooks/useProperties'
import { useDragSheet } from '../../../hooks/useDragSheet'
import LOCATIONS from '../data/locations'
import {
  PROPERTY_TYPES, BED_OPTIONS, BATH_OPTIONS,
  PRICE_MIN, PRICE_STEP, AREA_MAX,
} from '../data/filterOptions'
import '../../../styles/search.css'

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

  // URL search params are the single source of truth for every filter, so the
  // collapsed bar and the expanded sheet read/write the same place — and a
  // filtered search stays shareable and bookmarkable.
  const city = searchParams.get('city') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const propertyType = searchParams.get('type') || ''
  const listingType = searchParams.get('listing') || ''
  const beds = searchParams.get('beds') || ''
  const baths = searchParams.get('baths') || ''
  const minArea = searchParams.get('minArea') || ''
  const maxArea = searchParams.get('maxArea') || ''
  const sort = searchParams.get('sort') || 'newest'
  // TODO: id/referenca — not implemented yet; would read from searchParams here.
  // TODO: zona — blocked on a `zone` column on properties (see useProperties).

  const debouncedMin = useDebounced(minPrice)
  const debouncedMax = useDebounced(maxPrice)
  const debouncedMinArea = useDebounced(minArea)
  const debouncedMaxArea = useDebounced(maxArea)
  const debouncedSearch = useDebounced(searchText)

  // An inverted range is a typo in progress, not a query — hold the bound back
  // until it makes sense again so the user isn't shown a misleading empty state.
  const priceInvalid = Boolean(minPrice && maxPrice && Number(minPrice) > Number(maxPrice))
  const areaInvalid = Boolean(minArea && maxArea && Number(minArea) > Number(maxArea))

  const queryMin = useMemo(() => debouncedMin ? Number(debouncedMin) : null, [debouncedMin])
  const queryMax = useMemo(() => debouncedMax ? Number(debouncedMax) : null, [debouncedMax])
  const queryMinArea = useMemo(() => debouncedMinArea ? Number(debouncedMinArea) : null, [debouncedMinArea])
  const queryMaxArea = useMemo(() => debouncedMaxArea ? Number(debouncedMaxArea) : null, [debouncedMaxArea])

  const rangesValid = !priceInvalid && !areaInvalid

  const { properties, loading, loadingMore, hasMore, loadMore, totalCount } = useProperties({
    filter: propertyType || 'all',
    listingType: listingType || null,
    city: debouncedSearch || city || null,
    minPrice: rangesValid ? queryMin : null,
    maxPrice: rangesValid ? queryMax : null,
    beds: beds ? Number(beds) : null,
    baths: baths ? Number(baths) : null,
    minArea: rangesValid ? queryMinArea : null,
    maxArea: rangesValid ? queryMaxArea : null,
    paginate: true,
    sort,
  })

  const updateFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (value) params.set(key, value)
      else params.delete(key)
      return params
    }, { replace: true })
  }, [setSearchParams])

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
  const activeCount = [city, minPrice, maxPrice, propertyType, listingType, beds, baths, minArea, maxArea].filter(Boolean).length

  const barValues = useMemo(
    () => ({ type: propertyType, city, beds, baths, minPrice, maxPrice }),
    [propertyType, city, beds, baths, minPrice, maxPrice],
  )

  useEffect(() => {
    if (!filtersOpen) return
    const h = (e) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [filtersOpen])

  const { dragHandleProps, dragY, dragTransition } = useDragSheet({
    onDismiss: () => setFiltersOpen(false),
  })

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

        {/* Tier 1 — inline bar, ≥768px only. Hidden on mobile by CSS, where the
            "Filtrat" button above opens the same filters as a sheet. */}
        <FilterBar values={barValues} onChange={updateFilter} />
        {priceInvalid && (
          <div className="filter-warning" role="alert">
            <AlertCircle size={12} /> {t('search.rangeInvalid')}
          </div>
        )}
      </div>

      <div className="result-count">
        {/* count drives i18next's plural choice even though the string itself
            doesn't interpolate it — the number stays a separate bold span. */}
        <span><strong>{totalCount}</strong> {t('search.homesInView', { count: totalCount })}</span>
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
          <div
            className="filter-sheet"
            style={{ transform: `translateX(-50%) translateY(${dragY}px)`, transition: dragTransition }}
          >
            {/* Drag zone is deliberately just the grip + header — the filter
                fields below need to scroll normally, so they don't carry
                the drag handlers. */}
            <div {...dragHandleProps}>
              <div className="addsheet-grip" />
              <div className="filter-sheet__header">
                <h2 className="filter-sheet__title">{t('search.filtersTitle')}</h2>
                <button className="link-btn" onClick={resetFilters} style={{ color: 'var(--fho-orange-1)' }}>{t('search.reset')}</button>
              </div>
            </div>

            {/* City — also present in the inline bar, but the bar is hidden
                below 768px, so mobile needs its own control here. */}
            <div className="filter-section">
              <label className="filter-label">{t('search.city')}</label>
              <div className="filter-select">
                <MapPin size={15} aria-hidden="true" />
                <select value={city} onChange={e => updateFilter('city', e.target.value)} aria-label={t('search.city')}>
                  <option value="">{t('search.anyCity')}</option>
                  {LOCATIONS.map(l => <option key={l.city} value={l.city}>{l.city}</option>)}
                </select>
              </div>
              {/* TODO: Zona select goes directly below Qyteti, options from
                  LOCATIONS.find(l => l.city === city).zones — blocked on a
                  `zone` column on properties. */}
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
              {/* Open-ended by design: an empty max means no upper bound, so
                  the filter covers €{PRICE_MIN} upward with no ceiling. */}
              <div className="range-inputs">
                <label className="range-input">
                  <span>€</span>
                  <input type="number" inputMode="numeric" min={PRICE_MIN} step={PRICE_STEP} placeholder={t('search.minPrice')} value={minPrice} onChange={e => updateFilter('minPrice', e.target.value)} aria-label={t('search.minPrice')} />
                </label>
                <span className="range-dash">—</span>
                <label className="range-input">
                  <span>€</span>
                  <input type="number" inputMode="numeric" min={PRICE_MIN} step={PRICE_STEP} placeholder={t('search.maxPrice')} value={maxPrice} onChange={e => updateFilter('maxPrice', e.target.value)} aria-label={t('search.maxPrice')} />
                </label>
              </div>
              {priceInvalid && <div className="filter-warning" role="alert"><AlertCircle size={12} /> {t('search.rangeInvalid')}</div>}
            </div>

            {/* Surface — no slider on purpose: the listing form permits up to
                100,000 m², so any slider range wide enough to be correct would
                be unusable at residential scale. */}
            <div className="filter-section">
              <label className="filter-label">{t('search.surface')}</label>
              <div className="range-inputs">
                <label className="range-input">
                  <Maximize2 size={14} />
                  <input type="number" inputMode="numeric" min="0" max={AREA_MAX} placeholder={t('search.minArea')} value={minArea} onChange={e => updateFilter('minArea', e.target.value)} aria-label={t('search.minArea')} />
                  <span className="range-unit">m²</span>
                </label>
                <span className="range-dash">—</span>
                <label className="range-input">
                  <Maximize2 size={14} />
                  <input type="number" inputMode="numeric" min="0" max={AREA_MAX} placeholder={t('search.maxArea')} value={maxArea} onChange={e => updateFilter('maxArea', e.target.value)} aria-label={t('search.maxArea')} />
                  <span className="range-unit">m²</span>
                </label>
              </div>
              {areaInvalid && <div className="filter-warning" role="alert"><AlertCircle size={12} /> {t('search.rangeInvalid')}</div>}
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

            {/* Bathrooms */}
            <div className="filter-section">
              <label className="filter-label">{t('search.bathrooms')}</label>
              <div className="bed-chips">
                {BATH_OPTIONS.map(b => (
                  <button key={b ?? 'any'} className={`bed-chip ${(baths === '' && b === null) || baths === String(b) ? 'active' : ''}`}
                    onClick={() => updateFilter('baths', b === null ? '' : String(b))}>
                    {b === null ? t('search.anyBaths') : b === 4 ? '4+' : b}
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
              {t('search.showHomes', { count: totalCount })}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

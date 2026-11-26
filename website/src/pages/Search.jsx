import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { List, Map as MapIcon, SlidersHorizontal } from 'lucide-react'
import SearchPanel, { fieldsFrom } from '../components/SearchPanel'
import PropertyCard, { CardSkeleton } from '../components/PropertyCard'
import { EmptyState, ErrorState } from '../components/States'
import MoreFilters from '../components/MoreFilters'
import SaveSearchButton from '../components/SaveSearchButton'
import { filtersFromParams, getProperties, getPropertiesCount, PAGE_SIZE } from '../lib/api'
import Select from '../components/Select'

// Leaflet only loads when someone opens the map.
const SearchMap = lazy(() => import('../components/SearchMap'))
const EXTRA = ['zone', 'min', 'max', 'beds', 'baths', 'area', 'maxArea', 'features', 'ref']

export default function Search() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(key)), [key])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const onMap = params.get('view') === 'map'
  const active = EXTRA.filter((k) => params.get(k)).length

  const list = useInfiniteQuery({
    queryKey: ['search', filters],
    enabled: !onMap,
    queryFn: ({ pageParam }) => getProperties(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
  })
  const count = useQuery({ queryKey: ['count', filters], queryFn: () => getPropertiesCount(filters) })

  useEffect(() => {
    document.title = `${t('search.title')} | ${t('common.appName')}`
  }, [t])

  const setSort = (sort) => {
    const next = new URLSearchParams(params)
    if (sort === 'newest') next.delete('sort')
    else next.set('sort', sort)
    setParams(next, { replace: true })
  }

  const setView = (map) => {
    const next = new URLSearchParams(params)
    if (map) next.set('view', 'map')
    else next.delete('view')
    setParams(next, { replace: true })
  }

  const homes = list.data?.pages.flat() ?? []

  return (
    <div className="page">
      <div className="page-search">
        <div className="container">
          <h1 className="page-title">{t('search.title')}</h1>
          {/* Keyed by the URL so the fields follow back/forward navigation. */}
          <SearchPanel key={key} initial={fieldsFrom(params)} variant="bar" />
        </div>
      </div>
      <div className="container section-tight">
        <div className="results-bar">
          <p aria-live="polite">{count.data != null ? t('search.results', { count: count.data }) : ' '}</p>
          <div className="results-tools">
            <button type="button" className={`btn btn-outline btn-sm ${active ? 'is-active' : ''}`} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t('search.filtersTitle')}
              {active > 0 && <span className="count-badge">{active}</span>}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setView(!onMap)}>
              {onMap ? <List size={16} aria-hidden="true" /> : <MapIcon size={16} aria-hidden="true" />}
              {onMap ? t('search.listView') : t('search.mapView')}
            </button>
            {!onMap && (
              <label className="sort">
                <span>{t('search.sortLabel')}</span>
                <Select value={filters.sort} onChange={(e) => setSort(e.target.value)}>
                  {['newest', 'price_asc', 'price_desc'].map((s) => (
                    <option key={s} value={s}>
                      {t(`search.sort.${s}`)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        </div>
        <SaveSearchButton filters={filters} />
        <MoreFilters
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          params={params}
          onApply={(next) => {
            setFiltersOpen(false)
            setParams(next)
          }}
        />
        {onMap ? (
          <Suspense fallback={<div className="search-map is-skeleton" aria-busy="true" />}>
            <SearchMap filters={filters} />
          </Suspense>
        ) : list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <div className="grid">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : homes.length === 0 ? (
          <EmptyState title={t('search.empty')} hint={t('search.emptyHint')} />
        ) : (
          <>
            <div className="grid">
              {homes.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
            {list.hasNextPage && (
              <div className="load-more">
                <button type="button" className="btn btn-outline" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                  {t('common.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

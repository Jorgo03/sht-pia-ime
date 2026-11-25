import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import SearchPanel, { fieldsFrom } from '../components/SearchPanel'
import PropertyCard, { CardSkeleton } from '../components/PropertyCard'
import { EmptyState, ErrorState } from '../components/States'
import { filtersFromParams, getProperties, getPropertiesCount, PAGE_SIZE } from '../lib/api'

export default function Search() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(key)), [key])

  const list = useInfiniteQuery({
    queryKey: ['search', filters],
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
          <p aria-live="polite">{count.data != null ? t('search.results', { count: count.data }) : ' '}</p>
          <label className="sort">
            <span>{t('search.sortLabel')}</span>
            <select value={filters.sort} onChange={(e) => setSort(e.target.value)}>
              {['newest', 'price_asc', 'price_desc'].map((s) => (
                <option key={s} value={s}>
                  {t(`search.sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {list.isError ? (
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

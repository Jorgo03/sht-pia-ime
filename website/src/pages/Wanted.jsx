import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'
import { cityName } from '../lib/format'
import { formatRelativeTime } from '@/src/lib/format.js'

const PAGE = 24

// The wanted-homes board, as in the app (app/wanted.tsx): what buyers are
// looking for, for agents; everyone else is invited to post their own.
export default function Wanted() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, profile, ready, refreshProfile } = useAuth()
  const isAgent = profile?.role === 'agent'
  const board = useInfiniteQuery({
    queryKey: ['wanted-board', user?.id ?? null],
    enabled: !!user && isAgent,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('wanted_homes')
        .select('id, city, listing_type, max_price, min_bedrooms, notes, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE - 1)
      if (error) throw error
      return data ?? []
    },
    getNextPageParam: (last, pages) => (last.length < PAGE ? undefined : pages.length * PAGE),
  })
  const rows = board.data?.pages.flat() ?? []

  useEffect(() => {
    document.title = `${t('wanted.boardPre')} ${t('wanted.boardEm')} | ${t('common.appName')}`
  }, [t])

  // Signed in but the profile could not be read: say so, with a retry,
  // rather than a skeleton that never ends or the wrong role's page.
  if (ready && user && !profile) {
    return <div className="page container section"><ErrorState onRetry={() => refreshProfile().catch(() => {})} /></div>
  }

  return (
    <div className="page container section narrow">
      <div className="section-head">
        <div>
          <h1 className="page-title">{t('wanted.boardPre')} {t('wanted.boardEm')}</h1>
          <p>{isAgent ? t('wanted.agentHint') : t('wanted.boardIntro')}</p>
        </div>
        {!isAgent && (
          <Link to={user ? '/saved-searches?tab=wanted&new=1' : '/login?next=%2Fsaved-searches%3Ftab%3Dwanted%26new%3D1'} className="btn btn-primary">
            <Plus size={18} aria-hidden="true" />
            {t('wanted.postCta')}
          </Link>
        )}
      </div>
      {isAgent &&
        (board.isError ? (
          <ErrorState onRetry={() => board.refetch()} />
        ) : board.isPending ? (
          <ul className="viewings" aria-hidden="true"><li className="viewing is-skeleton" /></ul>
        ) : rows.length === 0 ? (
          <EmptyState title={t('agentDashboard.wantedEmpty')} />
        ) : (
          <>
            <ul className="viewings">
              {rows.map((w) => (
                <li key={w.id} className="viewing">
                  <div className="viewing-top">
                    <strong>{cityName(w.city, lang)} · {t(`search.${w.listing_type}`, { defaultValue: w.listing_type })}</strong>
                    <time dateTime={w.created_at} className="muted">{formatRelativeTime(w.created_at, lang)}</time>
                  </div>
                  <p className="muted">
                    {[w.max_price && `${t('addSheet.maxPrice')}: ${Number(w.max_price).toLocaleString(lang)}`, w.min_bedrooms && `${t('addSheet.minBedrooms')}: ${w.min_bedrooms}`].filter(Boolean).join(' · ')}
                  </p>
                  {w.notes && <p className="viewing-notes">{w.notes}</p>}
                </li>
              ))}
            </ul>
            {board.hasNextPage && (
              <div className="load-more">
                <button type="button" className="btn btn-outline" onClick={() => board.fetchNextPage()} disabled={board.isFetchingNextPage}>
                  {t('agents.loadMore')}
                </button>
              </div>
            )}
          </>
        ))}
    </div>
  )
}

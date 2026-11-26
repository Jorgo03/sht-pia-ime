import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Ban, Flag, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchPublicProfile, fetchPublisherListings, isUserId, profileInitials, publicProfileView } from '@/src/features/profiles/lib/publicProfile.js'
import { blockUser, loadBlockedIds, unblockUser } from '@/src/features/safety/lib/safety.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import PropertyCard, { CardSkeleton } from '../components/PropertyCard'
import { EmptyState, ErrorState } from '../components/States'
import ReportDialog from '../components/ReportDialog'
import { telUrl } from '../lib/format'

// Everyone's public page, agents and clients alike, with the homes they
// publish, as in the app (app/user/[id].tsx; /agent/<id> opens the same).
export default function PublicProfile() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const valid = isUserId(id)
  const prof = useQuery({ queryKey: ['public-profile', id], queryFn: () => fetchPublicProfile(supabase, id), enabled: valid })
  const listings = useInfiniteQuery({
    queryKey: ['publisher-listings', id],
    enabled: valid,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPublisherListings(supabase, id, pageParam),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, pg) => n + pg.rows.length, 0)
      return loaded < last.total ? pages.length : undefined
    },
  })
  const [blocked, setBlocked] = useState(false)
  const [reporting, setReporting] = useState(false)
  const view = publicProfileView(prof.data)
  const homes = listings.data?.pages.flatMap((pg) => pg.rows) ?? []
  const total = listings.data?.pages[0]?.total ?? 0
  const name = view?.name || t('publicProfile.unnamed')
  const self = user?.id === id

  useEffect(() => {
    if (user && valid) loadBlockedIds(supabase).then((ids) => setBlocked(ids.has(id)))
  }, [user, id, valid])
  useEffect(() => {
    document.title = `${view?.name || t('common.profile')} | ${t('common.appName')}`
  }, [view?.name, t])

  if (!valid || (prof.isSuccess && !view)) {
    return (
      <div className="page container section">
        <EmptyState title={t('publicProfile.unavailable')} />
      </div>
    )
  }
  if (prof.isError) {
    return (
      <div className="page container section">
        <ErrorState onRetry={() => prof.refetch()} />
      </div>
    )
  }

  const toggleBlock = async () => {
    if (blocked) return (await unblockUser(supabase, id)) && setBlocked(false)
    if (!window.confirm(t('safety.blockConfirm', { name }))) return
    if (await blockUser(supabase, id)) setBlocked(true)
  }

  return (
    <div className="page container section">
      <header className="profile-head">
        {view?.avatarUrl ? <img className="profile-avatar" src={view.avatarUrl} alt="" /> : <span className="profile-avatar agent-initials" aria-hidden="true">{profileInitials(name)}</span>}
        <div>
          <p className="muted small">{view?.kind === 'agent' ? t('publicProfile.agent') : t('auth.roleClient')}</p>
          <h1 className="page-title">{prof.isPending ? ' ' : name}</h1>
          {view?.office && <p className="muted">{view.office}</p>}
          <p className="muted small">{t('publicProfile.published', { n: total })}</p>
        </div>
        <div className="row-actions">
          {view?.phone && (
            <a className="btn btn-primary" href={telUrl(view.phone)}>
              <Phone size={18} aria-hidden="true" />
              {t('publicProfile.call', { phone: view.phone })}
            </a>
          )}
          {user && !self && (
            <>
              <button type="button" className="btn btn-outline" onClick={toggleBlock}>
                <Ban size={16} aria-hidden="true" />
                {blocked ? t('safety.unblockUser') : t('safety.blockUser')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setReporting(true)}>
                <Flag size={16} aria-hidden="true" />
                {t('safety.reportUser')}
              </button>
            </>
          )}
        </div>
      </header>
      <h2 className="section-title">{t('publicProfile.listingsTitle')}</h2>
      {listings.isError ? (
        <>
          <p className="state">{t('publicProfile.listingsFailed')}</p>
          <ErrorState onRetry={() => listings.refetch()} />
        </>
      ) : listings.isPending ? (
        <div className="grid">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : homes.length === 0 ? (
        <EmptyState title={t('publicProfile.empty')} />
      ) : (
        <>
          <div className="grid">{homes.map((p) => <PropertyCard key={p.id} property={p} />)}</div>
          {listings.hasNextPage && (
            <div className="load-more">
              <button type="button" className="btn btn-outline" onClick={() => listings.fetchNextPage()} disabled={listings.isFetchingNextPage}>
                {t('agents.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
      {user && <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={id} />}
    </div>
  )
}

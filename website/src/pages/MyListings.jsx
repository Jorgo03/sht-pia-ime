import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BarChart3, CircleCheck, Eye, Pause, Pencil, Play, Plus, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { closedStatusFor } from '@/src/features/listings/lib/listingForm.js'
import { pageWindow } from '@/src/lib/pageWindow.js'
import { gradientFor } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'
import { priceOf, titleOf } from '../lib/format'

const PAGE = 24

// The person's own listings, as in the app (app/my-listings/index.tsx):
// view, edit, stats, pause/activate, mark sold/rented, delete, import.
export default function MyListings() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, profile, ready } = useAuth()
  const [limit, setLimit] = useState(PAGE)
  const [rows, setRows] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState('loading')
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit + 1)
    if (error) return setStatus('error')
    const page = pageWindow(data, limit)
    setRows(page.items)
    setHasMore(page.hasMore)
    setStatus('ready')
  }, [user, limit])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    document.title = `${t('listing.myListings')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to="/login?next=/my-listings" replace />

  const setListingStatus = async (id, next) => {
    setFailed(false)
    // .select() so a write RLS filtered out (no row changed) counts as failed.
    const { data, error } = await supabase.from('properties').update({ status: next }).eq('id', id).select('id')
    if (error || !data?.length) return setFailed(true)
    setRows((l) => l.map((p) => (p.id === id ? { ...p, status: next } : p)))
  }
  const close = (p) => {
    const next = closedStatusFor(p.listing_type)
    if (window.confirm(`${next === 'sold' ? t('listing.confirmSoldTitle') : t('listing.confirmRentedTitle')}\n\n${t('listing.confirmClosedHint')}`)) setListingStatus(p.id, next)
  }
  const remove = async (id) => {
    if (!window.confirm(t('listing.confirmDelete'))) return
    const { data, error } = await supabase.from('properties').delete().eq('id', id).select('id')
    if (error || !data?.length) return setFailed(true)
    setRows((l) => l.filter((p) => p.id !== id))
  }

  return (
    <div className="page container section">
      <div className="section-head">
        <h1 className="page-title">{t('listing.myListings')}</h1>
        <div className="row-actions">
          {profile?.role === 'agent' && (
            <Link to="/listing/import" className="btn btn-outline">
              <Upload size={16} aria-hidden="true" />
              {t('import.entry')}
            </Link>
          )}
          <Link to="/listing/new" className="btn btn-primary">
            <Plus size={18} aria-hidden="true" />
            {t('listing.newListing')}
          </Link>
        </div>
      </div>
      {failed && <p className="form-error" role="alert">{t('errors.updateFailed')}</p>}
      {status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : status === 'loading' ? (
        <ul className="viewings" aria-hidden="true"><li className="viewing is-skeleton" /><li className="viewing is-skeleton" /></ul>
      ) : rows.length === 0 ? (
        <EmptyState title={t('listing.noListings')} hint={t('listing.noListingsDesc')}>
          <Link to="/listing/new" className="btn btn-primary">{t('listing.newListing')}</Link>
        </EmptyState>
      ) : (
        <>
          <ul className="my-listings">
            {rows.map((p) => {
              const photo = p.image_urls?.[0]
              const closable = p.status === 'active' || p.status === 'paused'
              return (
                <li key={p.id} className="my-listing">
                  <Link to={`/property/${p.id}`} className="my-listing-photo" style={photo ? undefined : { background: gradientFor(p.id) }}>
                    {photo && <img src={photo} alt="" loading="lazy" decoding="async" />}
                  </Link>
                  <div className="my-listing-body">
                    <div className="viewing-top">
                      <span className={`pill status-${p.status === 'active' ? 'confirmed' : p.status === 'paused' ? 'requested' : 'declined'}`}>{p.status === 'pending_review' ? t('moderation.hiddenBadge') : t(`listing.status.${p.status}`, { defaultValue: p.status })}</span>
                      {p.ref_code && <span className="muted small">{t('detail.reference')} {p.ref_code}</span>}
                    </div>
                    <Link to={`/property/${p.id}`} className="viewing-title">{titleOf(p, lang)}</Link>
                    <p className="strong">{priceOf(p, lang)}</p>
                    <div className="row-actions">
                      <Link className="btn btn-outline btn-sm" to={`/property/${p.id}`}><Eye size={15} aria-hidden="true" />{t('listing.actionView')}</Link>
                      <Link className="btn btn-outline btn-sm" to={`/listing/${p.id}/edit`}><Pencil size={15} aria-hidden="true" />{t('listing.edit')}</Link>
                      <Link className="btn btn-outline btn-sm" to={`/listing/${p.id}/analytics`}><BarChart3 size={15} aria-hidden="true" />{t('listing.actionStats')}</Link>
                      {closable && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setListingStatus(p.id, p.status === 'active' ? 'paused' : 'active')}>
                          {p.status === 'active' ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                          {p.status === 'active' ? t('listing.pause') : t('listing.activate')}
                        </button>
                      )}
                      {closable && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => close(p)}>
                          <CircleCheck size={15} aria-hidden="true" />
                          {closedStatusFor(p.listing_type) === 'sold' ? t('listing.actionSold') : t('listing.actionRented')}
                        </button>
                      )}
                      <button type="button" className="btn btn-outline btn-sm danger" onClick={() => remove(p.id)}>
                        <Trash2 size={15} aria-hidden="true" />
                        {t('listing.delete')}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <div className="load-more">
              <button type="button" className="btn btn-outline" onClick={() => setLimit((n) => n + PAGE)}>{t('common.loadMore')}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Building2, Eye, EyeOff, ShieldCheck, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QUEUES, isModerator, loadReports, resolveReport, setListingHidden } from '@/src/features/moderation/lib/moderation.js'
import { formatDate } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/States'

// Reported listings and users, as in the app's website moderation page
// (app/moderation.web.tsx). Only people in public.moderators get past the
// check, and the database enforces the same rule on every read and action.
export default function Moderation() {
  const { t, i18n } = useTranslation()
  const { user, ready } = useAuth()
  const [allowed, setAllowed] = useState(null)
  const [queue, setQueue] = useState('open')
  const queueRef = useRef('open')
  const [rows, setRows] = useState([])
  const [more, setMore] = useState(false)
  const [state, setState] = useState('loading')
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    document.title = `${t('moderation.title')} | ${t('common.appName')}`
  }, [t])

  useEffect(() => {
    if (!ready || !user) return
    let active = true
    isModerator(supabase).then((ok) => active && setAllowed(ok))
    return () => {
      active = false
    }
  }, [user, ready])

  const apply = useCallback((result) => {
    if (!result) return setState('error')
    setRows(result.rows)
    setMore(result.more)
    setState('ready')
  }, [])

  useEffect(() => {
    if (!allowed) return
    let active = true
    loadReports(supabase, { queue }).then((r) => active && apply(r))
    return () => {
      active = false
    }
  }, [allowed, queue, apply])

  if (ready && !user) return <Navigate to="/login?next=/moderation" replace />

  const switchQueue = (next) => {
    if (next === queue) return
    setState('loading')
    setRows([])
    queueRef.current = next
    setQueue(next)
  }
  const retry = () => {
    setState('loading')
    loadReports(supabase, { queue }).then(apply)
  }
  const loadMore = async () => {
    const asked = queue
    setLoadingMore(true)
    const result = await loadReports(supabase, { queue, offset: rows.length })
    setLoadingMore(false)
    // The queue was switched while this page loaded: its rows belong elsewhere.
    if (queueRef.current !== asked) return
    if (!result) return setState('error')
    setRows((prev) => [...prev, ...result.rows])
    setMore(result.more)
  }
  // A resolved report leaves the open queue; a hidden or restored listing is
  // updated on every report about it.
  const onResolved = (id) => setRows((prev) => (queue === 'open' ? prev.filter((r) => r.id !== id) : prev))
  const onListingChanged = (propertyId, hidden) =>
    setRows((prev) =>
      prev.map((r) =>
        r.property_id === propertyId && r.listing
          ? { ...r, listing: { ...r.listing, moderation_hold: hidden, status: hidden ? 'pending_review' : r.listing.status === 'pending_review' ? 'active' : r.listing.status } }
          : r,
      ),
    )

  let body
  if (allowed === null) body = <div className="viewing is-skeleton" aria-busy="true" />
  else if (!allowed) {
    body = (
      <div className="state">
        <ShieldCheck size={34} aria-hidden="true" />
        <p className="state-title">{t('moderation.notAllowed')}</p>
      </div>
    )
  } else {
    body = (
      <>
        <div className="tabs" role="tablist" aria-label={t('moderation.title')}>
          {QUEUES.map((q) => (
            <button key={q} type="button" role="tab" aria-selected={q === queue} className={q === queue ? 'is-on' : ''} onClick={() => switchQueue(q)}>
              {t(`moderation.queue.${q}`)}
            </button>
          ))}
        </div>
        {state === 'loading' ? (
          <div className="viewing is-skeleton" aria-busy="true" />
        ) : state === 'error' ? (
          <>
            <p className="state">{t('moderation.loadFailed')}</p>
            <ErrorState onRetry={retry} />
          </>
        ) : rows.length === 0 ? (
          <div className="state">
            <ShieldCheck size={34} aria-hidden="true" />
            <p className="state-title">{t(queue === 'open' ? 'moderation.empty' : 'moderation.emptyClosed')}</p>
          </div>
        ) : (
          <div className="mod-list">
            {rows.map((r) => (
              <ReportCard key={r.id} report={r} lang={i18n.resolvedLanguage} onResolved={onResolved} onListingChanged={onListingChanged} />
            ))}
            {more && (
              <div className="load-more">
                <button type="button" className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t('common.loading') : t('moderation.loadMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="page container section narrow">
      <h1 className="page-title">{t('moderation.title')}</h1>
      {allowed && <p className="muted">{t('moderation.subtitle')}</p>}
      {body}
    </div>
  )
}

function ReportCard({ report, lang, onResolved, onListingChanged }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const { listing, person } = report
  const open = report.status === 'open'

  const run = async (action) => {
    setBusy(true)
    setFailed(false)
    const ok = await action()
    setBusy(false)
    if (!ok) setFailed(true)
  }
  const toggleHidden = () =>
    run(async () => {
      if (!listing || !report.property_id) return false
      const hide = !listing.moderation_hold
      const ok = await setListingHidden(supabase, report.property_id, hide)
      if (ok) onListingChanged(report.property_id, hide)
      return ok
    })
  const resolve = (status) =>
    run(async () => {
      const ok = await resolveReport(supabase, report.id, status, note)
      if (ok) onResolved(report.id)
      return ok
    })

  return (
    <article className="panel mod-card">
      <div className="mod-head">
        <h2 className="panel-title">{t(`safety.reason.${report.reason}`)}</h2>
        <span className="muted small">{t('moderation.reportedOn', { date: formatDate(report.created_at, lang) })}</span>
      </div>
      {report.property_id && (
        <p className="mod-target">
          <Building2 size={16} aria-label={t('moderation.listing')} />
          {listing ? <Link to={`/property/${listing.id}`}>{listing.title || listing.id}</Link> : <span className="muted">{t('moderation.missingTarget')}</span>}
          {listing?.moderation_hold && <span className="pill">{t('moderation.hiddenBadge')}</span>}
        </p>
      )}
      {report.reported_user_id && (
        <p className="mod-target">
          <User size={16} aria-label={t('moderation.user')} />
          {person ? (
            person.role === 'agent' ? <Link to={`/agent/${person.id}`}>{person.full_name || person.id}</Link> : <span>{person.full_name || person.id}</span>
          ) : (
            <span className="muted">{t('moderation.missingTarget')}</span>
          )}
        </p>
      )}
      {report.details && <p className="mod-details">{report.details}</p>}
      {!open ? (
        <p className="muted small">
          {t(`moderation.status.${report.status}`)}
          {report.reviewed_at ? ` · ${formatDate(report.reviewed_at, lang)}` : ''}
          {report.resolution_note ? ` · ${report.resolution_note}` : ''}
        </p>
      ) : (
        <label className="field">
          <span>{t('moderation.note')}</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
        </label>
      )}
      <div className="row-actions">
        {listing && (
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={toggleHidden}>
            {listing.moderation_hold ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
            {t(listing.moderation_hold ? 'moderation.restore' : 'moderation.hide')}
          </button>
        )}
        {open && (
          <>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => resolve('actioned')}>{t('moderation.markActioned')}</button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => resolve('dismissed')}>{t('moderation.dismiss')}</button>
          </>
        )}
      </div>
      {failed && <p className="form-error" role="alert">{t('moderation.actionFailed')}</p>}
    </article>
  )
}

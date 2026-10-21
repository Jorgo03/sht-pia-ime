import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, EyeOff, Eye, ShieldCheck, User, RotateCcw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatDate } from '../../../lib/format'
import BackButton from '../../../shared/BackButton'
import { QUEUES, isModerator, loadReports, resolveReport, setListingHidden } from '../lib/moderation'

// Moderation queue for reported listings and users (docs/LAUNCH_TASKS.md F3).
// Only people the owner added to public.moderators get past the check, and
// the database enforces the same rule on every read and action; this page
// never decides access on its own.

export default function Moderation() {
  const { t, i18n } = useTranslation()
  const [allowed, setAllowed] = useState(null) // null while checking
  const [queue, setQueue] = useState('open')
  const [rows, setRows] = useState([])
  const [more, setMore] = useState(false)
  const [state, setState] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let active = true
    isModerator(supabase).then((ok) => { if (active) setAllowed(ok) })
    return () => { active = false }
  }, [])

  // State is set only when a request settles, never synchronously inside an
  // effect; switching queues and retrying reset to 'loading' themselves.
  const apply = useCallback((result) => {
    if (!result) { setState('error'); return }
    setRows(result.rows)
    setMore(result.more)
    setState('ready')
  }, [])

  useEffect(() => {
    if (!allowed) return
    let active = true
    loadReports(supabase, { queue }).then((result) => { if (active) apply(result) })
    return () => { active = false }
  }, [allowed, queue, apply])

  const switchQueue = (next) => {
    if (next === queue) return
    setState('loading')
    setRows([])
    setQueue(next)
  }

  const retry = () => {
    setState('loading')
    loadReports(supabase, { queue }).then(apply)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    const result = await loadReports(supabase, { queue, offset: rows.length })
    setLoadingMore(false)
    if (!result) { setState('error'); return }
    setRows((prev) => [...prev, ...result.rows])
    setMore(result.more)
  }

  // A resolved report leaves the open queue; a hidden or restored listing is
  // updated on every report about it.
  const onResolved = (id) => setRows((prev) => (queue === 'open' ? prev.filter((r) => r.id !== id) : prev))
  const onListingChanged = (propertyId, hidden) => setRows((prev) => prev.map((r) => (
    r.property_id === propertyId && r.listing
      ? { ...r, listing: { ...r.listing, moderation_hold: hidden, status: hidden ? 'pending_review' : r.listing.status === 'pending_review' ? 'active' : r.listing.status } }
      : r
  )))

  if (allowed === null) {
    return <div className="page mx-auto max-w-3xl" aria-busy="true"><div className="h-24 animate-pulse rounded-2xl bg-fho-surface-2" /></div>
  }

  if (!allowed) {
    return (
      <div className="page mx-auto max-w-3xl">
        <BackButton />
        <div className="placeholder-card mt-6">
          <div className="icon"><ShieldCheck size={24} /></div>
          <div className="font-medium">{t('moderation.notAllowed')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page mx-auto max-w-3xl">
      <BackButton />
      <h1 className="page-title">{t('moderation.title')}</h1>
      <p className="page-subtitle">{t('moderation.subtitle')}</p>

      <div className="segment-control mt-4" role="tablist" aria-label={t('moderation.title')}>
        {QUEUES.map((q) => (
          <button key={q} role="tab" aria-selected={q === queue} className={`segment ${q === queue ? 'active' : ''}`} onClick={() => switchQueue(q)}>
            {t(`moderation.queue.${q}`)}
          </button>
        ))}
      </div>

      {state === 'loading' ? (
        <div className="mt-6 grid gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-fho-surface-2" />)}
        </div>
      ) : state === 'error' ? (
        <div className="placeholder-card mt-6" role="alert">
          <div>{t('moderation.loadFailed')}</div>
          <button className="pill-btn" onClick={retry}><RotateCcw size={14} /> {t('common.retry')}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="placeholder-card mt-6">
          <div className="icon"><ShieldCheck size={24} /></div>
          <div className="font-medium">{t(queue === 'open' ? 'moderation.empty' : 'moderation.emptyClosed')}</div>
        </div>
      ) : (
        <>
          <ul className="m-0 mt-6 grid list-none gap-3 p-0">
            {rows.map((report) => (
              <ReportCard key={report.id} report={report} lang={i18n.language} onResolved={onResolved} onListingChanged={onListingChanged} />
            ))}
          </ul>
          {more && (
            <button className="pill-btn mx-auto mt-4" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t('common.loading') : t('moderation.loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ReportCard({ report, lang, onResolved, onListingChanged }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const listing = report.listing
  const person = report.person
  const open = report.status === 'open'
  const headingId = `report-${report.id}`

  const run = async (action) => {
    setBusy(true)
    setFailed(false)
    const ok = await action()
    setBusy(false)
    if (!ok) setFailed(true)
    return ok
  }

  const toggleHidden = () => run(async () => {
    const hide = !listing.moderation_hold
    const ok = await setListingHidden(supabase, report.property_id, hide)
    if (ok) onListingChanged(report.property_id, hide)
    return ok
  })

  const resolve = (status) => run(async () => {
    const ok = await resolveReport(supabase, report.id, status, note)
    if (ok) onResolved(report.id)
    return ok
  })

  return (
    <li className="placeholder-card items-stretch text-left" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="m-0 text-base font-semibold text-fho-text">{t(`safety.reason.${report.reason}`)}</h2>
        <span className="text-[12px] text-fho-text-muted">{t('moderation.reportedOn', { date: formatDate(report.created_at, lang) })}</span>
      </div>

      {report.property_id && (
        <div className="flex items-center gap-2 text-[14px]">
          <Building2 size={16} aria-hidden="true" />
          <span className="sr-only">{t('moderation.listing')}:</span>
          {listing
            ? <Link to={`/property/${listing.id}`} className="text-fho-text underline">{listing.title || listing.id}</Link>
            : <span className="text-fho-text-muted">{t('moderation.missingTarget')}</span>}
          {listing?.moderation_hold && <span className="rounded-full bg-fho-surface-2 px-2 py-0.5 text-[12px] text-fho-text">{t('moderation.hiddenBadge')}</span>}
        </div>
      )}
      {report.reported_user_id && (
        <div className="flex items-center gap-2 text-[14px]">
          <User size={16} aria-hidden="true" />
          <span className="sr-only">{t('moderation.user')}:</span>
          {person
            ? (person.role === 'agent'
              ? <Link to={`/agent/${person.id}`} className="text-fho-text underline">{person.full_name || person.id}</Link>
              : <span className="text-fho-text">{person.full_name || person.id}</span>)
            : <span className="text-fho-text-muted">{t('moderation.missingTarget')}</span>}
        </div>
      )}

      {report.details && <p className="m-0 whitespace-pre-wrap break-words text-[14px] text-fho-text-muted">{report.details}</p>}

      {!open && (
        <p className="m-0 text-[13px] text-fho-text-muted">
          {t(`moderation.status.${report.status}`)}
          {report.reviewed_at ? ` · ${formatDate(report.reviewed_at, lang)}` : ''}
          {report.resolution_note ? ` · ${report.resolution_note}` : ''}
        </p>
      )}

      {open && (
        <label className="grid gap-1 text-[13px] text-fho-text-muted">
          {t('moderation.note')}
          <textarea className="addsheet-input addsheet-textarea" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {listing && (
          <button className="pill-btn" disabled={busy} onClick={toggleHidden}>
            {listing.moderation_hold ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
            {' '}{t(listing.moderation_hold ? 'moderation.restore' : 'moderation.hide')}
          </button>
        )}
        {open && (
          <>
            <button className="pill-btn" disabled={busy} onClick={() => resolve('actioned')}>{t('moderation.markActioned')}</button>
            <button className="pill-btn" disabled={busy} onClick={() => resolve('dismissed')}>{t('moderation.dismiss')}</button>
          </>
        )}
      </div>
      {failed && <div className="nl-error" role="alert">{t('moderation.actionFailed')}</div>}
    </li>
  )
}

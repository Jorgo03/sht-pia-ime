import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatViewingWhen } from '@/src/lib/tiranaTime.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'
import { cityName, getLocalizedText } from '../lib/format'

// Viewings, as in the app (app/viewings/index.tsx): what the person asked for
// and, for agents and owners, the requests for their homes. RLS scopes rows.

export default function Viewings() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [status, setStatus] = useState('loading')
  const [loadedAt, setLoadedAt] = useState(0)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setStatus('loading')
    const { data, error } = await supabase
      .from('viewings')
      .select('*, property:properties(id, title, title_i18n, city, owner_id, agent_id)')
      .gte('scheduled_at', new Date(Date.now() - 365 * 864e5).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(500)
    if (error) return setStatus('error')
    const list = data ?? []
    setLoadedAt(Date.now())
    setRows(list)
    const ids = [...new Set(list.filter((v) => v.client_id !== user.id).map((v) => v.client_id))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, agency_name').in('id', ids)
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || p.agency_name || '?'])))
    }
    setStatus('ready')
  }, [user])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    document.title = `${t('viewings.title')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to="/login?next=/viewings" replace />

  const setViewing = async (id, next) => {
    setFailed(false)
    const { error } = await supabase.from('viewings').update({ status: next }).eq('id', id)
    if (error) return setFailed(true)
    setRows((list) => list.map((v) => (v.id === id ? { ...v, status: next } : v)))
  }

  const mine = rows.filter((v) => v.client_id === user?.id)
  const incoming = rows.filter((v) => v.client_id !== user?.id)

  const card = (v, isIncoming) => {
    const home = v.property
    const title = home ? getLocalizedText(home.title_i18n, lang) || home.title : '—'
    return (
      <li key={v.id} className="viewing">
        <div className="viewing-top">
          <span className={`pill status-${v.status}`}>{t(`viewings.status.${v.status}`, v.status)}</span>
          <time dateTime={v.scheduled_at}>{formatViewingWhen(v.scheduled_at)}</time>
        </div>
        {home ? <Link to={`/property/${home.id}`} className="viewing-title">{title}</Link> : <p className="viewing-title">{title}</p>}
        {home?.city && <p className="muted">{cityName(home.city, lang)}</p>}
        {isIncoming && <p className="muted">{t('viewings.from', { name: names[v.client_id] ?? '?' })}</p>}
        {v.notes && <p className="viewing-notes">{v.notes}</p>}
        <div className="row-actions">
          {isIncoming && v.status === 'requested' && (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(v.id, 'confirmed')}>{t('viewings.confirm')}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(v.id, 'declined')}>{t('viewings.decline')}</button>
            </>
          )}
          {isIncoming && v.status === 'confirmed' && new Date(v.scheduled_at).getTime() <= loadedAt && (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(v.id, 'completed')}>{t('viewings.markCompleted')}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(v.id, 'no_show')}>{t('viewings.markNoShow')}</button>
            </>
          )}
          {!isIncoming && (v.status === 'requested' || v.status === 'confirmed') && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(v.id, 'cancelled')}>{t('viewings.cancel')}</button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="page container section narrow">
      <div className="section-head">
        <h1 className="page-title">{t('viewings.title')}</h1>
      </div>
      {failed && <p className="form-error" role="alert">{t('errors.generic')}</p>}
      {status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : status === 'loading' ? (
        <ul className="viewings" aria-hidden="true"><li className="viewing is-skeleton" /><li className="viewing is-skeleton" /></ul>
      ) : rows.length === 0 ? (
        <EmptyState title={t('viewings.empty')} hint={t('viewings.emptyHint')}>
          <Link to="/search" className="btn btn-primary">{t('site.cta.search')}</Link>
        </EmptyState>
      ) : (
        <>
          {incoming.length > 0 && (
            <section aria-labelledby="incoming-title" className="viewings-group">
              <h2 id="incoming-title">{t('viewings.incoming')}</h2>
              <ul className="viewings">{incoming.map((v) => card(v, true))}</ul>
            </section>
          )}
          {mine.length > 0 && (
            <section aria-labelledby="mine-title" className="viewings-group">
              <h2 id="mine-title">{t('viewings.mine')}</h2>
              <ul className="viewings">{mine.map((v) => card(v, false))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

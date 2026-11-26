import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BarChart3, Building2, Eye, Mail, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatViewingClock, formatViewingWhen, tiranaDayStart } from '@/src/lib/tiranaTime.js'
import { wantedMatches } from '@/src/features/leads/lib/leads.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/States'
import { cityName, formatPrice, getLocalizedText, titleOf } from '../lib/format'

// The agent's workspace, as in the app (app/agent-dashboard/index.tsx):
// totals, today's viewings, requests to answer, and buyers looking now with
// which of the agent's own homes fit them.
export default function AgentDashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, profile, ready } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [open, setOpen] = useState({})

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const since = new Date(Date.now() - 30 * 864e5).toISOString()
      const { data: mine, error: e1 } = await supabase.from('properties').select('id, status, title, title_i18n, city, listing_type, price, currency, beds').or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`)
      if (e1) throw e1
      const ids = (mine ?? []).map((p) => p.id)
      let views = 0
      for (let i = 0; i < ids.length; i += 150) {
        const { count, error: e } = await supabase.from('property_activity').select('id', { count: 'exact', head: true }).in('property_id', ids.slice(i, i + 150)).eq('type', 'view').gte('created_at', since)
        if (e) throw e
        views += count ?? 0
      }
      const dayStart = tiranaDayStart()
      const dayEnd = tiranaDayStart(new Date(dayStart.getTime() + 36 * 3600e3))
      const [conv, leads, pending, wanted, today] = await Promise.all([
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
        supabase.from('viewings').select('*, property:properties(id, title, title_i18n, city)').eq('status', 'requested').neq('client_id', user.id).order('scheduled_at', { ascending: true }).limit(10),
        supabase.from('wanted_homes').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(10),
        supabase.from('viewings').select('id, client_id, scheduled_at, status, property:properties(id, title, title_i18n, city)').in('status', ['requested', 'confirmed']).neq('client_id', user.id).gte('scheduled_at', dayStart.toISOString()).lt('scheduled_at', dayEnd.toISOString()).order('scheduled_at', { ascending: true }).limit(20),
      ])
      const failed = [conv, leads, pending, wanted, today].find((r) => r.error)
      if (failed) throw failed.error
      const clientIds = [...new Set([...(pending.data ?? []), ...(today.data ?? [])].map((v) => v.client_id))]
      let clients = {}
      if (clientIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', clientIds)
        clients = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))
      }
      setData({
        stats: { listings: (mine ?? []).filter((p) => p.status === 'active').length, views, conversations: conv.count ?? 0, leads: leads.count ?? 0 },
        own: mine ?? [],
        pending: pending.data ?? [],
        today: today.data ?? [],
        wanted: wanted.data ?? [],
        clients,
      })
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    document.title = `${t('agentDashboard.title')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to="/login?next=/agent-dashboard" replace />
  if (ready && profile && profile.role !== 'agent') {
    return <div className="page container section"><p className="state">{t('site.agentsOnly')}</p></div>
  }

  const answer = async (id, status) => {
    const { error: e } = await supabase.from('viewings').update({ status }).eq('id', id)
    if (e) {
      setActionError(true)
      return setTimeout(() => setActionError(false), 3000)
    }
    setData((d) => ({ ...d, pending: d.pending.filter((v) => v.id !== id) }))
  }

  const cards = data && [
    [Building2, t('agentDashboard.statListings'), data.stats.listings, '/my-listings'],
    [Eye, t('agentDashboard.statViews'), data.stats.views],
    [Mail, t('agentDashboard.statConversations'), data.stats.conversations, '/messages'],
    [Users, t('agentDashboard.statLeads'), data.stats.leads, '/leads'],
  ]
  const homeTitle = (h) => (h ? getLocalizedText(h.title_i18n, lang) || h.title : '—')

  return (
    <div className="page container section">
      <div className="section-head">
        <div>
          <p className="muted small">{t('agentDashboard.kicker')}</p>
          <h1 className="page-title">{t('agentDashboard.headlinePre')} {t('agentDashboard.headlineEm')}</h1>
        </div>
      </div>
      {actionError && <p className="form-error" role="alert">{t('errors.updateFailed')}</p>}
      {error ? (
        <ErrorState onRetry={load} />
      ) : !data ? (
        <div className="stat-grid" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="stat is-skeleton" />)}</div>
      ) : (
        <>
          <div className="stat-grid">
            {cards.map(([Icon, label, value, to]) => {
              const inner = (
                <>
                  <Icon size={20} aria-hidden="true" />
                  <strong>{value}</strong>
                  <span>{label}</span>
                </>
              )
              return to ? <Link key={label} to={to} className="stat">{inner}</Link> : <div key={label} className="stat">{inner}</div>
            })}
          </div>
          <Link to="/performance" className="panel report-link">
            <BarChart3 size={22} aria-hidden="true" />
            <span>
              <strong>{t('performance.entry')}</strong>
              <span className="muted small">{t('performance.entrySub')}</span>
            </span>
          </Link>

          <div className="dash-grid">
            <section className="panel" aria-labelledby="today-title">
              <h2 id="today-title" className="panel-title">{t('agentDashboard.today')}</h2>
              {data.today.length === 0 ? (
                <p className="muted">{t('agentDashboard.todayEmpty')}</p>
              ) : (
                <ul className="activity">
                  {data.today.map((v) => (
                    <li key={v.id}>
                      <span>
                        <strong>{formatViewingClock(v.scheduled_at)}</strong>{' '}
                        {v.property ? <Link to={`/property/${v.property.id}`}>{homeTitle(v.property)}</Link> : '—'}
                      </span>
                      <span className="muted small">{data.clients[v.client_id]?.full_name ?? ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel" aria-labelledby="pending-title">
              <div className="panel-head">
                <h2 id="pending-title" className="panel-title">{t('agentDashboard.pendingViewings')}</h2>
                <Link to="/viewings" className="text-link small">{t('home.seeAll')}</Link>
              </div>
              {data.pending.length === 0 ? (
                <p className="muted">{t('agentDashboard.noPendingViewings')}</p>
              ) : (
                <ul className="viewings">
                  {data.pending.map((v) => (
                    <li key={v.id} className="viewing">
                      <time className="muted small" dateTime={v.scheduled_at}>{formatViewingWhen(v.scheduled_at)}</time>
                      {v.property && <Link className="viewing-title" to={`/property/${v.property.id}`}>{homeTitle(v.property)}</Link>}
                      <p className="muted small">{t('viewings.from', { name: data.clients[v.client_id]?.full_name ?? '?' })}</p>
                      <div className="row-actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => answer(v.id, 'confirmed')}>{t('viewings.confirm')}</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => answer(v.id, 'declined')}>{t('viewings.decline')}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="panel" aria-labelledby="wanted-title">
            <div className="panel-head">
              <div>
                <h2 id="wanted-title" className="panel-title">{t('agentDashboard.wantedFeed')}</h2>
                <p className="muted small">{t('agentDashboard.wantedFeedSub')}</p>
              </div>
              <Link to="/wanted" className="text-link small">{t('home.seeAll')}</Link>
            </div>
            {data.wanted.length === 0 ? (
              <p className="muted">{t('agentDashboard.wantedEmpty')}</p>
            ) : (
              <ul className="viewings">
                {data.wanted.map((w) => {
                  const matches = wantedMatches(w, data.own.filter((p) => p.status === 'active'))
                  return (
                    <li key={w.id} className="viewing">
                      <strong>{cityName(w.city, lang)} · {t(`search.${w.listing_type}`, { defaultValue: w.listing_type })}</strong>
                      <p className="muted small">
                        {[w.max_price && `${t('addSheet.maxPrice')}: ${Number(w.max_price).toLocaleString(lang)}`, w.min_bedrooms && `${t('addSheet.minBedrooms')}: ${w.min_bedrooms}`].filter(Boolean).join(' · ')}
                      </p>
                      {w.notes && <p className="viewing-notes">{w.notes}</p>}
                      {matches.length === 0 ? (
                        <p className="muted small">{t('agentDashboard.noMatches')}</p>
                      ) : (
                        <>
                          <button type="button" className="text-link small link-plain" aria-expanded={!!open[w.id]} onClick={() => setOpen((o) => ({ ...o, [w.id]: !o[w.id] }))}>
                            {t('agentDashboard.matches', { count: matches.length })} · {open[w.id] ? t('agentDashboard.hideMatches') : t('agentDashboard.showMatches')}
                          </button>
                          {open[w.id] && (
                            <ul className="match-list">
                              {matches.map((m) => (
                                <li key={m.id}>
                                  <Link to={`/property/${m.id}`}>{titleOf(m, lang)}</Link> <span className="muted small">{formatPrice(m.price, lang, m.currency)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

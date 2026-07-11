import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Eye, MessageCircle, CalendarDays, Users, Check, X, MapPin, Heart } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatDate, getLocalizedText } from '../../../lib/format'

export default function AgentDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [stats, setStats] = useState({ listings: 0, views: 0, conversations: 0, leads: 0 })
  const [pendingViewings, setPendingViewings] = useState([])
  const [clientProfiles, setClientProfiles] = useState({})
  const [wantedFeed, setWantedFeed] = useState([])
  const [actionError, setActionError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(false)
    try {
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data: myProps } = await supabase
        .from('properties')
        .select('id, status')
        .or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`)
      const propIds = (myProps ?? []).map(p => p.id)

      const [viewsRes, convRes, leadsRes, viewingsRes, wantedRes] = await Promise.all([
        propIds.length
          ? supabase.from('property_activity').select('id', { count: 'exact', head: true })
              .in('property_id', propIds).eq('type', 'view').gte('created_at', since.toISOString())
          : Promise.resolve({ count: 0 }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
        supabase.from('viewings')
          .select('*, property:properties(id, title, title_i18n, city)')
          .eq('status', 'requested')
          .neq('client_id', user.id)
          .order('scheduled_at', { ascending: true })
          .limit(10),
        supabase.from('wanted_homes').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(10),
      ])

      setStats({
        listings: (myProps ?? []).filter(p => p.status === 'active').length,
        views: viewsRes.count ?? 0,
        conversations: convRes.count ?? 0,
        leads: leadsRes.count ?? 0,
      })
      const pv = viewingsRes.data ?? []
      setPendingViewings(pv)
      setWantedFeed(wantedRes.data ?? [])

      const clientIds = [...new Set([...pv.map(v => v.client_id), ...(wantedRes.data ?? []).map(w => w.client_id)])]
      if (clientIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', clientIds)
        setClientProfiles(Object.fromEntries((profs ?? []).map(p => [p.id, p])))
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const setViewingStatus = async (id, status) => {
    const { error: err } = await supabase.from('viewings').update({ status }).eq('id', id)
    if (err) {
      setActionError(true)
      setTimeout(() => setActionError(false), 3000)
      return
    }
    setPendingViewings(prev => prev.filter(v => v.id !== id))
  }

  const statCards = [
    { icon: Building2, label: t('agentDashboard.statListings'), value: stats.listings, to: '/my-listings' },
    { icon: Eye, label: t('agentDashboard.statViews'), value: stats.views },
    { icon: MessageCircle, label: t('agentDashboard.statConversations'), value: stats.conversations, to: '/messages' },
    { icon: Users, label: t('agentDashboard.statLeads'), value: stats.leads },
  ]

  return (
    <div className="page">
      <div className="screen-head" style={{ padding: 0 }}>
        <div className="screen-kicker"><span className="screen-kicker__dash" />{t('agentDashboard.kicker')}</div>
        <h1 className="screen-headline">{t('agentDashboard.headlinePre')} <em>{t('agentDashboard.headlineEm')}</em>.</h1>
      </div>

      {actionError && (
        <div className="addsheet-toast" role="alert" onClick={() => setActionError(false)}>{t('errors.updateFailed')}</div>
      )}

      {loading ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>
      ) : error ? (
        <div className="placeholder-card" style={{ marginTop: 16 }}>
          <div>{t('common.error')}</div>
          <button className="cta-pill" style={{ marginTop: 12, maxWidth: 200 }} onClick={load}>{t('common.retry')}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
            {statCards.map(({ icon: Icon, label, value, to }) => (
              <div
                key={label}
                role={to ? 'button' : undefined}
                tabIndex={to ? 0 : undefined}
                onClick={() => to && navigate(to)}
                onKeyDown={e => { if (to && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(to) } }}
                style={{ background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 14, border: '0.5px solid var(--fho-border)', textAlign: 'center', cursor: to ? 'pointer' : 'default' }}
              >
                <Icon size={20} style={{ color: 'var(--fho-orange-1)' }} />
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          <section style={{ marginTop: 24 }}>
            <header className="section-title" style={{ padding: 0 }}>
              <h2>{t('agentDashboard.pendingViewings')}</h2>
              <button className="link-btn" style={{ color: 'var(--fho-orange-1)' }} onClick={() => navigate('/viewings')}>{t('home.seeAll')}</button>
            </header>
            {pendingViewings.length === 0 ? (
              <div className="placeholder-card"><div style={{ fontSize: 13, color: 'var(--fho-text-muted)' }}>{t('agentDashboard.noPendingViewings')}</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingViewings.map(v => {
                  const title = v.property ? (getLocalizedText(v.property.title_i18n, i18n.language) || v.property.title) : ''
                  const client = clientProfiles[v.client_id]
                  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(v.scheduled_at))
                  return (
                    <div key={v.id} className="placeholder-card" style={{ textAlign: 'left', alignItems: 'stretch', gap: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                      <div style={{ fontSize: 13, color: 'var(--fho-text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CalendarDays size={13} /> {formatDate(v.scheduled_at, i18n.language)} · {time}
                        {client && <span>· {client.full_name || '?'}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button className="pill-btn" onClick={() => setViewingStatus(v.id, 'confirmed')}><Check size={14} /> {t('viewings.confirm')}</button>
                        <button className="pill-btn" onClick={() => setViewingStatus(v.id, 'declined')}><X size={14} /> {t('viewings.decline')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section style={{ marginTop: 24 }}>
            <header className="section-title" style={{ padding: 0 }}>
              <h2>{t('agentDashboard.wantedFeed')}</h2>
              <span className="mono-eyebrow">{t('agentDashboard.wantedFeedSub')}</span>
            </header>
            {wantedFeed.length === 0 ? (
              <div className="placeholder-card">
                <div className="icon"><Heart size={22} /></div>
                <div style={{ fontSize: 13, color: 'var(--fho-text-muted)' }}>{t('agentDashboard.wantedEmpty')}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wantedFeed.map(w => {
                  const client = clientProfiles[w.client_id]
                  return (
                    <div key={w.id} className="placeholder-card" style={{ textAlign: 'left', alignItems: 'stretch', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          <MapPin size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {w.city} · {t(`listing.type.${w.listing_type}`, w.listing_type)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{formatDate(w.created_at, i18n.language)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--fho-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {w.max_price && <span>{t('addSheet.maxPrice')}: {formatPrice(w.max_price, i18n.language)}</span>}
                        {w.min_bedrooms && <span>{t('addSheet.minBedrooms')}: {w.min_bedrooms}+</span>}
                        {client?.full_name && <span>· {client.full_name}</span>}
                      </div>
                      {w.notes && <div style={{ fontSize: 13, color: 'var(--fho-text-muted)' }}>{w.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

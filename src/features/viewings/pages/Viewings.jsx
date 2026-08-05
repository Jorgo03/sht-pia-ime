import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Check, X, MapPin } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import BackButton from '../../../shared/BackButton'
import { supabase } from '../../../lib/supabase'
import { getLocalizedText, formatDate } from '../../../lib/format'

const STATUS_COLORS = {
  requested: 'var(--fho-status-paused, #f39c12)',
  confirmed: 'var(--fho-status-active, #27ae60)',
  declined: 'var(--fho-status-sold, #c0392b)',
  cancelled: 'var(--fho-status-draft, #7f8c8d)',
}

function formatWhen(iso, lang) {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
  return `${formatDate(iso, lang)} · ${time}`
}

export default function Viewings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [viewings, setViewings] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setViewings([]); setLoading(false); return }
    // RLS returns only rows where the user is the client, the agent, or the
    // property owner — no explicit filter needed.
    const { data } = await supabase
      .from('viewings')
      .select('*, property:properties(id, title, title_i18n, city, owner_id, agent_id)')
      .order('scheduled_at', { ascending: true })
    const rows = data ?? []
    setViewings(rows)

    const clientIds = [...new Set(rows.filter(v => v.client_id !== user.id).map(v => v.client_id))]
    if (clientIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, agency_name').in('id', clientIds)
      setProfiles(Object.fromEntries((profs ?? []).map(p => [p.id, p])))
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const setStatus = async (id, status) => {
    const { error } = await supabase.from('viewings').update({ status }).eq('id', id)
    if (error) {
      setActionError(true)
      setTimeout(() => setActionError(false), 3000)
      return
    }
    setViewings(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  const mine = viewings.filter(v => v.client_id === user?.id)
  const incoming = viewings.filter(v => v.client_id !== user?.id)

  const Row = ({ v, isIncoming }) => {
    const title = v.property ? (getLocalizedText(v.property.title_i18n, i18n.language) || v.property.title) : ''
    const client = profiles[v.client_id]
    return (
      <div className="placeholder-card" style={{ textAlign: 'left', alignItems: 'stretch', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span
            style={{ fontWeight: 600, fontSize: 14, cursor: v.property ? 'pointer' : 'default' }}
            onClick={() => v.property && navigate(`/property/${v.property.id}`)}
          >
            {title || t('viewings.title')}
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: STATUS_COLORS[v.status] + '20', color: STATUS_COLORS[v.status], whiteSpace: 'nowrap' }}
          >
            {t(`viewings.status.${v.status}`, v.status)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fho-text-muted)' }}>
          <CalendarDays size={13} /> {formatWhen(v.scheduled_at, i18n.language)}
          {v.property?.city && <><MapPin size={13} style={{ marginLeft: 8 }} /> {v.property.city}</>}
        </div>
        {isIncoming && client && (
          <div style={{ fontSize: 13 }}>{t('viewings.from', { name: client.full_name || client.agency_name || '?' })}</div>
        )}
        {v.notes && <div style={{ fontSize: 13, color: 'var(--fho-text-muted)' }}>{v.notes}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {isIncoming && v.status === 'requested' && (
            <>
              <button className="pill-btn" onClick={() => setStatus(v.id, 'confirmed')}><Check size={14} /> {t('viewings.confirm')}</button>
              <button className="pill-btn" onClick={() => setStatus(v.id, 'declined')}><X size={14} /> {t('viewings.decline')}</button>
            </>
          )}
          {!isIncoming && (v.status === 'requested' || v.status === 'confirmed') && (
            <button className="pill-btn" onClick={() => setStatus(v.id, 'cancelled')}><X size={14} /> {t('viewings.cancel')}</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <BackButton />
      <div className="screen-head" style={{ padding: 0 }}>
        <div className="screen-kicker"><span className="screen-kicker__dash" />{t('viewings.kicker')}</div>
        <h1 className="screen-headline">{t('viewings.headlinePre')} <em>{t('viewings.headlineEm')}</em>.</h1>
      </div>

      {actionError && (
        <div className="addsheet-toast" role="alert" onClick={() => setActionError(false)}>{t('errors.updateFailed')}</div>
      )}

      {loading ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>
      ) : viewings.length === 0 ? (
        <div className="placeholder-card" style={{ marginTop: 16 }}>
          <div className="icon"><CalendarDays size={24} /></div>
          <div style={{ fontWeight: 500 }}>{t('viewings.empty')}</div>
          <div style={{ color: 'var(--fho-text-muted)', fontSize: 13 }}>{t('viewings.emptyHint')}</div>
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <h2 className="section-title__bare" style={{ padding: 0 }}>{t('viewings.mine')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {mine.map(v => <Row key={v.id} v={v} isIncoming={false} />)}
              </div>
            </section>
          )}
          {incoming.length > 0 && (
            <section style={{ marginTop: 20 }}>
              <h2 className="section-title__bare" style={{ padding: 0 }}>{t('viewings.incoming')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {incoming.map(v => <Row key={v.id} v={v} isIncoming />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

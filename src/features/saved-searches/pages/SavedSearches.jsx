import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search as SearchIcon, Heart, Trash2, Bell, BellOff, Play, MapPin } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'
import { formatPrice, formatDate } from '../../../lib/format'

// saved_searches.filters JSONB → /search URL params. Only known keys pass.
function filtersToParams(filters = {}) {
  const params = new URLSearchParams()
  if (filters.city) params.set('city', filters.city)
  if (filters.listing_type) params.set('listing', filters.listing_type)
  if (filters.type) params.set('type', filters.type)
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice))
  if (filters.beds) params.set('beds', String(filters.beds))
  return params.toString()
}

export default function SavedSearches() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('searches')
  const [searches, setSearches] = useState([])
  const [wanted, setWanted] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(false)

  const flashError = () => {
    setActionError(true)
    setTimeout(() => setActionError(false), 3000)
  }

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const [s, w] = await Promise.all([
      supabase.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('wanted_homes').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    ])
    setSearches(s.data ?? [])
    setWanted(w.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const toggleAlerts = async (row) => {
    const next = !row.alerts_enabled
    const { error } = await supabase.from('saved_searches').update({ alerts_enabled: next }).eq('id', row.id)
    if (error) { flashError(); return }
    setSearches(prev => prev.map(s => s.id === row.id ? { ...s, alerts_enabled: next } : s))
  }

  const deleteSearch = async (id) => {
    const { error } = await supabase.from('saved_searches').delete().eq('id', id)
    if (error) { flashError(); return }
    setSearches(prev => prev.filter(s => s.id !== id))
  }

  const closeWanted = async (row) => {
    const next = row.status === 'open' ? 'closed' : 'open'
    const { error } = await supabase.from('wanted_homes').update({ status: next }).eq('id', row.id)
    if (error) { flashError(); return }
    setWanted(prev => prev.map(w => w.id === row.id ? { ...w, status: next } : w))
  }

  const deleteWanted = async (id) => {
    const { error } = await supabase.from('wanted_homes').delete().eq('id', id)
    if (error) { flashError(); return }
    setWanted(prev => prev.filter(w => w.id !== id))
  }

  const iconBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8,
    border: '0.5px solid var(--fho-border)', background: 'var(--fho-bg)', color: 'var(--fho-text)',
  }

  return (
    <div className="page">
      <div className="screen-head" style={{ padding: 0 }}>
        <div className="screen-kicker"><span className="screen-kicker__dash" />{t('saved.kicker')}</div>
        <h1 className="screen-headline">{t('saved.headlinePre')} <em>{t('saved.headlineEm')}</em>.</h1>
      </div>

      <div className="segment-control" style={{ marginTop: 12 }}>
        <button className={`segment ${tab === 'searches' ? 'active' : ''}`} onClick={() => setTab('searches')}>
          {t('saved.tabSearches')} ({searches.length})
        </button>
        <button className={`segment ${tab === 'wanted' ? 'active' : ''}`} onClick={() => setTab('wanted')}>
          {t('saved.tabWanted')} ({wanted.length})
        </button>
      </div>

      {actionError && (
        <div className="addsheet-toast" role="alert" onClick={() => setActionError(false)}>{t('errors.updateFailed')}</div>
      )}

      {loading ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>
      ) : tab === 'searches' ? (
        searches.length === 0 ? (
          <div className="placeholder-card" style={{ marginTop: 16 }}>
            <div className="icon"><SearchIcon size={24} /></div>
            <div style={{ fontWeight: 500 }}>{t('saved.emptySearches')}</div>
            <div style={{ color: 'var(--fho-text-muted)', fontSize: 13 }}>{t('saved.emptySearchesHint')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {searches.map(s => (
              <div key={s.id} className="placeholder-card" style={{ textAlign: 'left', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{formatDate(s.created_at, i18n.language)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--fho-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.filters?.city && <span><MapPin size={12} style={{ display: 'inline', verticalAlign: -2 }} /> {s.filters.city}</span>}
                  {s.filters?.listing_type && <span>{t(`listing.type.${s.filters.listing_type}`, s.filters.listing_type)}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="pill-btn" onClick={() => navigate(`/search?${filtersToParams(s.filters)}`)}>
                    <Play size={13} /> {t('saved.run')}
                  </button>
                  <button
                    style={iconBtn}
                    onClick={() => toggleAlerts(s)}
                    aria-label={s.alerts_enabled ? t('saved.alertsOff') : t('saved.alertsOn')}
                    title={s.alerts_enabled ? t('saved.alertsOff') : t('saved.alertsOn')}
                  >
                    {s.alerts_enabled ? <Bell size={14} /> : <BellOff size={14} />}
                  </button>
                  <button style={{ ...iconBtn, color: '#e74c3c' }} onClick={() => deleteSearch(s.id)} aria-label={t('saved.delete')} title={t('saved.delete')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : wanted.length === 0 ? (
        <div className="placeholder-card" style={{ marginTop: 16 }}>
          <div className="icon"><Heart size={24} /></div>
          <div style={{ fontWeight: 500 }}>{t('saved.emptyWanted')}</div>
          <div style={{ color: 'var(--fho-text-muted)', fontSize: 13 }}>{t('saved.emptyWantedHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {wanted.map(w => (
            <div key={w.id} className="placeholder-card" style={{ textAlign: 'left', alignItems: 'stretch', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  <MapPin size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {w.city} · {t(`listing.type.${w.listing_type}`, w.listing_type)}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: (w.status === 'open' ? 'var(--fho-status-active, #27ae60)' : 'var(--fho-status-draft, #7f8c8d)') + '20',
                    color: w.status === 'open' ? 'var(--fho-status-active, #27ae60)' : 'var(--fho-status-draft, #7f8c8d)',
                  }}
                >
                  {t(`saved.wantedStatus.${w.status}`, w.status)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--fho-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {w.max_price && <span>{t('addSheet.maxPrice')}: {formatPrice(w.max_price, i18n.language)}</span>}
                {w.min_bedrooms && <span>{t('addSheet.minBedrooms')}: {w.min_bedrooms}</span>}
              </div>
              {w.notes && <div style={{ fontSize: 13, color: 'var(--fho-text-muted)' }}>{w.notes}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="pill-btn" onClick={() => closeWanted(w)}>
                  {w.status === 'open' ? t('saved.markClosed') : t('saved.markOpen')}
                </button>
                <button style={{ ...iconBtn, color: '#e74c3c' }} onClick={() => deleteWanted(w.id)} aria-label={t('saved.delete')} title={t('saved.delete')}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

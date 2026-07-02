import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, BarChart3, Eye, Pause, Play, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatPrice, imageFor, getLocalizedText } from '../lib/format'

const STATUS_COLORS = {
  active: 'var(--fho-status-active, #27ae60)',
  paused: 'var(--fho-status-paused, #f39c12)',
  sold: 'var(--fho-status-sold, #c0392b)',
  rented: 'var(--fho-status-rented, #8e44ad)',
  draft: 'var(--fho-status-draft, #7f8c8d)',
}

export default function MyListings() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('properties')
      .select('*')
      .or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setListings(data || [])
        setLoading(false)
      })
  }, [user])

  const toggleStatus = async (id, current) => {
    const next = current === 'active' ? 'paused' : 'active'
    await supabase.from('properties').update({ status: next }).eq('id', id)
    setListings(prev => prev.map(p => p.id === id ? { ...p, status: next } : p))
  }

  const deleteListing = async (id) => {
    if (!confirm(t('listing.confirmDelete'))) return
    await supabase.from('properties').delete().eq('id', id)
    setListings(prev => prev.filter(p => p.id !== id))
  }

  if (!user) {
    return (
      <div className="page">
        <h1 className="page-title">{t('listing.myListings')}</h1>
        <div className="placeholder-card empty-state">
          <div style={{ fontWeight: 500 }}>{t('favourites.loginPrompt')}</div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/profile')}>{t('common.signIn')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{t('listing.myListings')}</h1>
        <button
          onClick={() => navigate('/new-listing')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--fho-orange-1), var(--fho-orange-2))', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        ><Plus size={16} /> {t('listing.newListing')}</button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>
      ) : listings.length === 0 ? (
        <div className="placeholder-card empty-state">
          <div style={{ fontSize: 32 }}>🏠</div>
          <div style={{ fontWeight: 500 }}>{t('listing.noListings')}</div>
          <div style={{ color: 'var(--fho-text-muted)', fontSize: 13 }}>{t('listing.noListingsDesc')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {listings.map(p => {
            const title = getLocalizedText(p.title_i18n, i18n.language) || p.title
            const bg = p.image_urls?.[0]
              ? { backgroundImage: `url(${p.image_urls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: imageFor(p) }

            return (
              <div key={p.id} style={{ display: 'flex', gap: 12, background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', border: '0.5px solid var(--fho-border)', overflow: 'hidden' }}>
                <div style={{ ...bg, width: 100, minHeight: 90, flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '10px 12px 10px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: STATUS_COLORS[p.status] + '20', color: STATUS_COLORS[p.status] }}>
                        {t(`listing.status.${p.status}`)}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fho-orange-2)', marginTop: 2 }}>
                      {formatPrice(p.price, i18n.language, p.currency)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => navigate(`/property/${p.id}`)} title={t('listing.viewPublic')} style={iconBtnStyle}><Eye size={14} /></button>
                    <button onClick={() => navigate(`/my-listings/${p.id}/dashboard`)} title={t('listing.viewDashboard')} style={iconBtnStyle}><BarChart3 size={14} /></button>
                    <button onClick={() => toggleStatus(p.id, p.status)} title={p.status === 'active' ? t('listing.pause') : t('listing.activate')} style={iconBtnStyle}>
                      {p.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={() => deleteListing(p.id)} title={t('listing.delete')} style={{ ...iconBtnStyle, color: '#e74c3c' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const iconBtnStyle = {
  width: 30, height: 30, borderRadius: 8, border: '0.5px solid var(--fho-border)',
  background: 'var(--fho-bg)', color: 'var(--fho-text)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, BarChart3, Eye, Pause, Play, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import BackButton from '../../../shared/BackButton'
import { supabase } from '../../../lib/supabase'
import { formatPrice, imageFor, getLocalizedText } from '../../../lib/format'

const STATUS_COLORS = {
  active: 'var(--fho-status-active, #27ae60)',
  paused: 'var(--fho-status-paused, #f39c12)',
  sold: 'var(--fho-status-sold, #c0392b)',
  rented: 'var(--fho-status-rented, #8e44ad)',
  draft: 'var(--fho-status-draft, #7f8c8d)',
}

const iconBtn =
  'flex h-[30px] w-[30px] items-center justify-center rounded-lg border-[0.5px] border-fho-border bg-fho-bg p-0 text-fho-text'

export default function MyListings() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(false)

  const flashError = () => {
    setActionError(true)
    setTimeout(() => setActionError(false), 3000)
  }

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
    const { error } = await supabase.from('properties').update({ status: next }).eq('id', id)
    if (error) { flashError(); return }
    setListings(prev => prev.map(p => p.id === id ? { ...p, status: next } : p))
  }

  const deleteListing = async (id) => {
    if (!confirm(t('listing.confirmDelete'))) return
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) { flashError(); return }
    setListings(prev => prev.filter(p => p.id !== id))
  }

  if (!user) {
    return (
      <div className="page">
        <h1 className="page-title">{t('listing.myListings')}</h1>
        <div className="placeholder-card empty-state">
          <div className="font-medium">{t('favourites.loginPrompt')}</div>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/profile')}>{t('common.signIn')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <BackButton />
      <div className="mb-2 flex items-center justify-between">
        <h1 className="page-title m-0">{t('listing.myListings')}</h1>
        <button
          onClick={() => navigate('/new-listing')}
          className="flex items-center gap-1.5 rounded-[10px] border-none bg-[linear-gradient(135deg,var(--fho-orange-1),var(--fho-orange-2))] px-4 py-2 text-[13px] font-semibold text-white"
        ><Plus size={16} /> {t('listing.newListing')}</button>
      </div>

      {actionError && (
        <div className="addsheet-toast" role="alert" onClick={() => setActionError(false)}>{t('errors.updateFailed')}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-fho-text-muted">{t('common.loading')}</div>
      ) : listings.length === 0 ? (
        <div className="placeholder-card empty-state">
          <div className="text-[32px]">🏠</div>
          <div className="font-medium">{t('listing.noListings')}</div>
          <div className="text-[13px] text-fho-text-muted">{t('listing.noListingsDesc')}</div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {listings.map(p => {
            const title = getLocalizedText(p.title_i18n, i18n.language) || p.title
            const bg = p.image_urls?.[0]
              ? { backgroundImage: `url(${p.image_urls[0]})` }
              : { background: imageFor(p) }

            return (
              <div key={p.id} className="flex gap-3 overflow-hidden rounded-fho-md border-[0.5px] border-fho-border bg-fho-surface">
                <div className="min-h-[90px] w-[100px] shrink-0 bg-cover bg-center" style={bg} />
                <div className="flex flex-1 flex-col justify-between py-2.5 pr-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{title}</span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: STATUS_COLORS[p.status] + '20', color: STATUS_COLORS[p.status] }}
                      >
                        {t(`listing.status.${p.status}`)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold text-fho-orange-2">
                      {formatPrice(p.price, i18n.language, p.currency)}
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button onClick={() => navigate(`/property/${p.id}`)} title={t('listing.viewPublic')} className={iconBtn}><Eye size={14} /></button>
                    <button onClick={() => navigate(`/my-listings/${p.id}/dashboard`)} title={t('listing.viewDashboard')} className={iconBtn}><BarChart3 size={14} /></button>
                    <button onClick={() => toggleStatus(p.id, p.status)} title={p.status === 'active' ? t('listing.pause') : t('listing.activate')} className={iconBtn}>
                      {p.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={() => deleteListing(p.id)} title={t('listing.delete')} className={`${iconBtn} text-[#e74c3c]`}><Trash2 size={14} /></button>
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

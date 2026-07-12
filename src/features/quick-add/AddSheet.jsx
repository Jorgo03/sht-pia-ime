import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Search, Heart, Eye, Users, CalendarDays, Building2, X, ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import { useAddSheet } from './AddSheetContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { parseSearchQuery } from '../../lib/ai'
import { isEnabled } from '../../lib/flags'
import './AddSheet.css'

function SaveSearchForm({ onClose, onSuccess, onError }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [listingType, setListingType] = useState('sale')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !user) return
    setLoading(true)
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      name: name.trim(),
      filters: { city: city.trim() || null, listing_type: listingType },
      alerts_enabled: true,
    })
    setLoading(false)
    if (!error) onSuccess(t('addSheet.searchSaved'))
    else onError()
  }

  return (
    <div className="addsheet-miniform">
      <button className="link-btn otp-back" onClick={onClose}><ArrowLeft size={16} /> {t('common.back')}</button>
      <h3 className="addsheet-miniform__title">{t('addSheet.client.search.title')}</h3>
      <input className="addsheet-input" placeholder={t('addSheet.searchName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="addsheet-input" placeholder={t('listing.city')} value={city} onChange={(e) => setCity(e.target.value)} />
      <div className="addsheet-toggle-row">
        <button className={`addsheet-toggle ${listingType === 'sale' ? 'active' : ''}`} onClick={() => setListingType('sale')}>{t('search.sale')}</button>
        <button className={`addsheet-toggle ${listingType === 'rent' ? 'active' : ''}`} onClick={() => setListingType('rent')}>{t('search.rent')}</button>
      </div>
      <button className="cta-pill" onClick={handleSubmit} disabled={loading || !name.trim()}>
        {loading ? t('common.loading') : t('common.save')}
      </button>
    </div>
  )
}

function WantedHomeForm({ onClose, onSuccess, onError }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [city, setCity] = useState('')
  const [listingType, setListingType] = useState('sale')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBedrooms, setMinBedrooms] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  // Task 5: free-text wish → ai-parse-search → structured criteria,
  // plus a live count of active listings matching what's filled in.
  const [describe, setDescribe] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseFailed, setParseFailed] = useState(false)
  const [matchCount, setMatchCount] = useState(null)

  const handleParse = async () => {
    if (!describe.trim() || parsing) return
    setParsing(true)
    setParseFailed(false)
    const filters = await parseSearchQuery(describe)
    setParsing(false)
    if (!filters) { setParseFailed(true); return }
    if (filters.city) setCity(filters.city)
    if (filters.listing === 'sale' || filters.listing === 'rent') setListingType(filters.listing)
    if (filters.maxPrice) setMaxPrice(String(filters.maxPrice))
    if (filters.beds) setMinBedrooms(String(filters.beds))
    setNotes(describe.trim())
  }

  // Live match count against active listings (debounced, head-count only)
  useEffect(() => {
    if (!city.trim()) { setMatchCount(null); return }
    let active = true
    const id = setTimeout(async () => {
      let q = supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('listing_type', listingType)
        .ilike('city', `%${city.trim()}%`)
      if (maxPrice) q = q.lte('price', Number(maxPrice))
      if (minBedrooms) q = q.gte('beds', Number(minBedrooms))
      const { count } = await q
      if (active) setMatchCount(count ?? 0)
    }, 600)
    return () => { active = false; clearTimeout(id) }
  }, [city, listingType, maxPrice, minBedrooms])

  const handleSubmit = async () => {
    if (!city.trim() || !user) return
    setLoading(true)
    const { error } = await supabase.from('wanted_homes').insert({
      client_id: user.id,
      city: city.trim(),
      listing_type: listingType,
      max_price: maxPrice ? Number(maxPrice) : null,
      min_bedrooms: minBedrooms ? Number(minBedrooms) : null,
      notes: notes.trim() || null,
    })
    setLoading(false)
    if (!error) onSuccess(t('addSheet.wantedSaved'))
    else onError()
  }

  return (
    <div className="addsheet-miniform">
      <button className="link-btn otp-back" onClick={onClose}><ArrowLeft size={16} /> {t('common.back')}</button>
      <h3 className="addsheet-miniform__title">{t('addSheet.client.wanted.title')}</h3>
      {isEnabled('aiSearch') && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            className="addsheet-input addsheet-textarea"
            style={{ flex: 1, minHeight: 56 }}
            placeholder={t('wanted.describePlaceholder')}
            value={describe}
            onChange={(e) => { setDescribe(e.target.value); setParseFailed(false) }}
          />
          <button
            className="cta-pill"
            style={{ width: 46, height: 46, flexShrink: 0, padding: 0 }}
            onClick={handleParse}
            disabled={parsing || !describe.trim()}
            aria-label={t('search.aiButton')}
            title={t('search.aiButton')}
          >
            {parsing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          </button>
        </div>
      )}
      {parseFailed && <div style={{ fontSize: 12, color: 'var(--fho-text-muted)' }}>{t('search.aiFailed')}</div>}
      <input className="addsheet-input" placeholder={t('listing.city') + ' *'} value={city} onChange={(e) => setCity(e.target.value)} autoFocus />
      <div className="addsheet-toggle-row">
        <button className={`addsheet-toggle ${listingType === 'sale' ? 'active' : ''}`} onClick={() => setListingType('sale')}>{t('search.sale')}</button>
        <button className={`addsheet-toggle ${listingType === 'rent' ? 'active' : ''}`} onClick={() => setListingType('rent')}>{t('search.rent')}</button>
      </div>
      <input className="addsheet-input" placeholder={t('addSheet.maxPrice')} type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
      <input className="addsheet-input" placeholder={t('addSheet.minBedrooms')} type="number" value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} />
      <textarea className="addsheet-input addsheet-textarea" placeholder={t('addSheet.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {matchCount !== null && (
        <div style={{ fontSize: 12, color: 'var(--fho-orange-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Home size={13} /> {t('wanted.matchesNow', { n: matchCount })}
        </div>
      )}
      <button className="cta-pill" onClick={handleSubmit} disabled={loading || !city.trim()}>
        {loading ? t('common.loading') : t('common.save')}
      </button>
    </div>
  )
}

function NewLeadForm({ onClose, onSuccess, onError }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !user) return
    setLoading(true)
    const { error } = await supabase.from('leads').insert({
      agent_id: user.id,
      name: name.trim(),
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    })
    setLoading(false)
    if (!error) onSuccess(t('addSheet.leadSaved'))
    else onError()
  }

  return (
    <div className="addsheet-miniform">
      <button className="link-btn otp-back" onClick={onClose}><ArrowLeft size={16} /> {t('common.back')}</button>
      <h3 className="addsheet-miniform__title">{t('addSheet.agent.lead.title')}</h3>
      <input className="addsheet-input" placeholder={t('addSheet.leadName') + ' *'} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="addsheet-input" placeholder={t('addSheet.leadPhone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <textarea className="addsheet-input addsheet-textarea" placeholder={t('addSheet.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="cta-pill" onClick={handleSubmit} disabled={loading || !name.trim()}>
        {loading ? t('common.loading') : t('common.save')}
      </button>
    </div>
  )
}

export default function AddSheet() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { open, closeSheet, setToast, miniForm, setMiniForm } = useAddSheet()
  const { user, isAgent } = useAuth()

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') closeSheet() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, closeSheet])

  if (!open) return null

  const handleSuccess = (msg) => {
    closeSheet()
    setToast(msg)
  }

  const handleError = () => {
    closeSheet()
    setToast(t('addSheet.saveError'))
  }

  const handleAction = (action) => {
    switch (action.key) {
      case 'listing':
        closeSheet()
        if (!user) navigate('/profile', { state: { intent: 'signin' } })
        else navigate('/new-listing')
        break
      case 'search':
        if (!user) { closeSheet(); navigate('/profile', { state: { intent: 'signin' } }); break }
        setMiniForm('search')
        break
      case 'wanted':
        if (!user) { closeSheet(); navigate('/profile', { state: { intent: 'signin' } }); break }
        setMiniForm('wanted')
        break
      case 'visit':
        closeSheet()
        // Booking happens on the property page ("Schedule viewing" CTA);
        // this entry point just gets the user browsing.
        navigate('/search')
        break
      case 'lead':
        setMiniForm('lead')
        break
      case 'viewing':
        closeSheet()
        navigate('/new-listing?openHouse=0')
        break
      case 'open':
        closeSheet()
        navigate('/new-listing?openHouse=1')
        break
      default:
        closeSheet()
        setToast(action.title)
    }
  }

  const clientActions = [
    { key: 'listing', icon: Home, title: t('addSheet.client.listing.title'), sub: t('addSheet.client.listing.sub'), primary: true },
    { key: 'search', icon: Search, title: t('addSheet.client.search.title'), sub: t('addSheet.client.search.sub') },
    { key: 'wanted', icon: Heart, title: t('addSheet.client.wanted.title'), sub: t('addSheet.client.wanted.sub') },
    { key: 'visit', icon: Eye, title: t('addSheet.client.visit.title'), sub: t('addSheet.client.visit.sub') },
  ]

  const agentActions = [
    { key: 'listing', icon: Building2, title: t('addSheet.agent.listing.title'), sub: t('addSheet.agent.listing.sub'), primary: true },
    { key: 'lead', icon: Users, title: t('addSheet.agent.lead.title'), sub: t('addSheet.agent.lead.sub') },
    { key: 'viewing', icon: Eye, title: t('addSheet.agent.viewing.title'), sub: t('addSheet.agent.viewing.sub') },
    { key: 'open', icon: CalendarDays, title: t('addSheet.agent.open.title'), sub: t('addSheet.agent.open.sub') },
  ]

  const actions = isAgent ? agentActions : clientActions

  return (
    <>
      <div className="addsheet-backdrop" onClick={closeSheet} />
      <div className="addsheet-panel">
        <div className="addsheet-grip" />
        <div className="addsheet-header">
          <h2 className="addsheet-title">
            {t('addSheet.title')} <em>{t('addSheet.titleEm')}</em>
          </h2>
          <button className="addsheet-close" onClick={closeSheet} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        {miniForm === 'search' && (
          <SaveSearchForm onClose={() => setMiniForm(null)} onSuccess={handleSuccess} onError={handleError} />
        )}
        {miniForm === 'wanted' && (
          <WantedHomeForm onClose={() => setMiniForm(null)} onSuccess={handleSuccess} onError={handleError} />
        )}
        {miniForm === 'lead' && (
          <NewLeadForm onClose={() => setMiniForm(null)} onSuccess={handleSuccess} onError={handleError} />
        )}

        {!miniForm && (
          <div className="addsheet-actions">
            {actions.map((a) => {
              const Icon = a.icon
              return (
                <button
                  key={a.key}
                  className={`addsheet-action ${a.primary ? 'primary' : ''}`}
                  onClick={() => handleAction(a)}
                >
                  <div className="addsheet-action__icon">
                    <Icon size={22} />
                  </div>
                  <div className="addsheet-action__text">
                    <span className="addsheet-action__title">{a.title}</span>
                    <span className="addsheet-action__sub">{a.sub}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

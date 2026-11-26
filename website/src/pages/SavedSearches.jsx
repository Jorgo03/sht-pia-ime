import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Bell, BellOff, Mail, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countMatches, markSeen, newMatchCount, setEmailAlerts } from '@/src/features/saved-searches/lib/matches.js'
import { FORM_LIMITS, inIntRange } from '@/src/lib/formLimits.js'
import { CITIES } from '@/src/features/properties/data/locations.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'
import { cityName, formatPrice } from '../lib/format'

// Saved searches and wanted homes, as in the app (app/saved-searches/index.tsx):
// two tabs, each with its own form, alerts and new-match counts.

/** A saved search's filters as website search parameters. */
function searchHref(f = {}) {
  const q = new URLSearchParams()
  if (f.city) q.set('city', f.city)
  if (f.listing_type) q.set('deal', f.listing_type)
  if (f.type && f.type !== 'all') q.set('type', f.type)
  if (f.beds) q.set('beds', f.beds)
  if (f.minArea) q.set('area', f.minArea)
  if (f.maxPrice) q.set('max', f.maxPrice)
  return `/search${q.size ? `?${q}` : ''}`
}

export default function SavedSearches() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'wanted' ? 'wanted' : 'searches'
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')
  const [status, setStatus] = useState('loading')
  const [searches, setSearches] = useState([])
  const [counts, setCounts] = useState({})
  const [wanted, setWanted] = useState([])
  const [flash, setFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', type: 'sale', maxPrice: '', minBeds: '', notes: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const load = useCallback(async () => {
    if (!user) return
    const [s, w] = await Promise.all([
      supabase.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('wanted_homes').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    ])
    if (s.error || w.error) return setStatus('error')
    setSearches(s.data ?? [])
    setWanted(w.data ?? [])
    setStatus('ready')
    const entries = await Promise.all((s.data ?? []).map(async (row) => [row.id, await countMatches(supabase, row.filters)]))
    setCounts(Object.fromEntries(entries))
  }, [user])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    document.title = `${t('saved.headlinePre')} ${t('saved.headlineEm')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to="/login?next=/saved-searches" replace />

  const fail = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 3000)
  }
  const switchTab = (next) => {
    setFormOpen(false)
    setParams(next === 'wanted' ? { tab: 'wanted' } : {}, { replace: true })
  }

  const submitSearch = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const filters = { city: form.city.trim() || null, listing_type: form.type }
    const current = await countMatches(supabase, filters)
    const { error } = await supabase.from('saved_searches').insert({ user_id: user.id, name: form.name.trim(), filters, alerts_enabled: true, last_match_count: current ?? 0 })
    setSaving(false)
    if (error) return fail()
    setForm((f) => ({ ...f, name: '', city: '' }))
    setFormOpen(false)
    load()
  }

  const submitWanted = async (e) => {
    e.preventDefault()
    if (!form.city.trim()) return
    if (!inIntRange(form.maxPrice, 1, FORM_LIMITS.maxPrice) || !inIntRange(form.minBeds, 0, FORM_LIMITS.maxBedrooms)) return fail()
    setSaving(true)
    const { error } = await supabase.from('wanted_homes').insert({
      client_id: user.id,
      city: form.city.trim(),
      listing_type: form.type,
      max_price: form.maxPrice ? Number(form.maxPrice) : null,
      min_bedrooms: form.minBeds ? Number(form.minBeds) : null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (error) return fail()
    setForm({ name: '', city: '', type: 'sale', maxPrice: '', minBeds: '', notes: '' })
    setFormOpen(false)
    load()
  }

  const update = async (table, id, patch, apply) => {
    const { error } = await supabase.from(table).update(patch).eq('id', id)
    if (error) return fail()
    apply()
  }
  const remove = async (table, id, confirmKey, apply) => {
    if (!window.confirm(t(confirmKey))) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return fail()
    apply()
  }

  const cities = [...CITIES].sort((a, b) => cityName(a.city, lang).localeCompare(cityName(b.city, lang), lang))
  const cityField = (
    <label className="field">
      <span>{t('listing.city')}</span>
      <input list="city-list" className="input" value={form.city} onChange={set('city')} maxLength={80} required={tab === 'wanted'} />
      <datalist id="city-list">
        {cities.map((c) => (
          <option key={c.id} value={c.city}>{cityName(c.city, lang)}</option>
        ))}
      </datalist>
    </label>
  )
  const typeField = (
    <div className="seg" role="radiogroup" aria-label={t('search.listingType')}>
      {['sale', 'rent'].map((v) => (
        <label key={v} className={form.type === v ? 'is-on' : ''}>
          <input type="radio" name="type" value={v} checked={form.type === v} onChange={set('type')} />
          {t(`search.${v}`)}
        </label>
      ))}
    </div>
  )

  return (
    <div className="page container section narrow">
      <div className="section-head">
        <h1 className="page-title">{t('saved.headlinePre')} {t('saved.headlineEm')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setFormOpen((o) => !o)} aria-expanded={formOpen}>
          <Plus size={18} aria-hidden="true" />
          {tab === 'wanted' ? t('saved.newWanted') : t('saved.newSearch')}
        </button>
      </div>
      <div className="tabs" role="tablist">
        {[['searches', t('saved.tabSearches')], ['wanted', t('saved.tabWanted')]].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => switchTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {flash && <p className="form-error" role="alert">{t('errors.updateFailed')}</p>}

      {formOpen && (
        <form className="panel form-grid" onSubmit={tab === 'wanted' ? submitWanted : submitSearch}>
          {tab === 'searches' && (
            <label className="field">
              <span>{t('addSheet.searchName')}</span>
              <input className="input" value={form.name} onChange={set('name')} maxLength={80} required autoFocus />
            </label>
          )}
          {cityField}
          {typeField}
          {tab === 'wanted' && (
            <>
              <label className="field">
                <span>{t('addSheet.maxPrice')}</span>
                <input className="input" inputMode="numeric" value={form.maxPrice} onChange={set('maxPrice')} />
              </label>
              <label className="field">
                <span>{t('addSheet.minBedrooms')}</span>
                <input className="input" inputMode="numeric" value={form.minBeds} onChange={set('minBeds')} />
              </label>
              <label className="field span-2">
                <span>{t('addSheet.notes')}</span>
                <textarea className="textarea" rows={3} maxLength={1000} value={form.notes} onChange={set('notes')} />
              </label>
            </>
          )}
          <div className="row-actions span-2">
            <button type="button" className="btn btn-outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
          </div>
        </form>
      )}

      {status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : status === 'loading' ? (
        <ul className="viewings" aria-hidden="true"><li className="viewing is-skeleton" /></ul>
      ) : tab === 'searches' ? (
        searches.length === 0 ? (
          <EmptyState title={t('saved.emptySearches')} hint={t('saved.emptySearchesHint')} />
        ) : (
          <ul className="viewings">
            {searches.map((s) => {
              const fresh = newMatchCount(counts[s.id], s.last_match_count)
              const f = s.filters ?? {}
              return (
                <li key={s.id} className="viewing">
                  <div className="viewing-top">
                    <strong>{s.name}</strong>
                    {fresh > 0 && <span className="pill status-requested">{t('saved.newMatches', { count: fresh })}</span>}
                  </div>
                  <p className="muted">{[f.city && cityName(f.city, lang), f.listing_type && t(`search.${f.listing_type}`)].filter(Boolean).join(' · ')}</p>
                  <div className="row-actions">
                    <Link
                      to={searchHref(f)}
                      className="btn btn-primary btn-sm"
                      onClick={() => markSeen(supabase, s.id, counts[s.id])}
                    >
                      <Search size={16} aria-hidden="true" />
                      {t('saved.run')}
                    </Link>
                    <button type="button" className="btn btn-outline btn-sm" aria-pressed={s.alerts_enabled} title={t('saved.alertsHint')}
                      onClick={() => update('saved_searches', s.id, { alerts_enabled: !s.alerts_enabled }, () => setSearches((l) => l.map((x) => (x.id === s.id ? { ...x, alerts_enabled: !s.alerts_enabled } : x))))}>
                      {s.alerts_enabled ? <Bell size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />}
                      {s.alerts_enabled ? t('saved.alertsOn') : t('saved.alertsOff')}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" aria-pressed={!!s.email_alerts} title={t('saved.emailHint')}
                      onClick={async () => ((await setEmailAlerts(supabase, s.id, !s.email_alerts)) ? setSearches((l) => l.map((x) => (x.id === s.id ? { ...x, email_alerts: !s.email_alerts } : x))) : fail())}>
                      <Mail size={16} aria-hidden="true" />
                      {s.email_alerts ? t('saved.emailOn') : t('saved.emailOff')}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => remove('saved_searches', s.id, 'saved.confirmDeleteSearch', () => setSearches((l) => l.filter((x) => x.id !== s.id)))}>
                      <Trash2 size={16} aria-hidden="true" />
                      {t('saved.delete')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : wanted.length === 0 ? (
        <EmptyState title={t('saved.emptyWanted')} hint={t('saved.emptyWantedHint')} />
      ) : (
        <ul className="viewings">
          {wanted.map((w) => (
            <li key={w.id} className="viewing">
              <div className="viewing-top">
                <strong>{cityName(w.city, lang)} · {t(`search.${w.listing_type}`, { defaultValue: w.listing_type })}</strong>
                <span className={`pill ${w.status === 'open' ? 'status-confirmed' : ''}`}>{t(`saved.wantedStatus.${w.status}`, { defaultValue: w.status })}</span>
              </div>
              <p className="muted">
                {[w.max_price && `≤ ${formatPrice(w.max_price, lang, 'EUR')}`, w.min_bedrooms && `${w.min_bedrooms}+ ${t('property.beds')}`].filter(Boolean).join(' · ')}
              </p>
              {w.notes && <p className="viewing-notes">{w.notes}</p>}
              <div className="row-actions">
                <button type="button" className="btn btn-outline btn-sm"
                  onClick={() => update('wanted_homes', w.id, { status: w.status === 'open' ? 'closed' : 'open' }, () => setWanted((l) => l.map((x) => (x.id === w.id ? { ...x, status: w.status === 'open' ? 'closed' : 'open' } : x))))}>
                  {w.status === 'open' ? t('saved.markClosed') : t('saved.markOpen')}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => remove('wanted_homes', w.id, 'saved.confirmDeleteWanted', () => setWanted((l) => l.filter((x) => x.id !== w.id)))}>
                  <Trash2 size={16} aria-hidden="true" />
                  {t('saved.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

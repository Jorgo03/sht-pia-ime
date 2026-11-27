import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail, MessageCircle, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LEAD_LIMITS, LEAD_STATUSES, leadRow, leadSearchFilter } from '@/src/features/leads/lib/leads.js'
import { formatDate } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'
import { telUrl, whatsappUrl } from '../lib/format'
import Select from '../components/Select'

const PAGE = 30
const EMPTY = { name: '', phone: '', email: '', notes: '', status: 'new' }

// The agent's private lead tracker, as in the app (app/leads/index.tsx):
// search, filter by status, add / edit / delete, call, WhatsApp, email.
export default function Leads() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [hasMore, setHasMore] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | lead
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)
  const [listFailed, setListFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const dialog = useRef(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = setTimeout(() => setSearch(query), 300)
    return () => clearTimeout(id)
  }, [query])

  const page = useCallback(
    async (offset) => {
      let q = supabase.from('leads').select('*').eq('agent_id', user.id).order('created_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + PAGE - 1)
      if (filter !== 'all') q = q.eq('status', filter)
      const or = leadSearchFilter(search)
      if (or) q = q.or(or)
      const { data, error } = await q
      return error ? null : data ?? []
    },
    [user, filter, search],
  )

  const load = useCallback(async () => {
    if (!user) return
    const run = ++seq.current
    const data = await page(0)
    if (run !== seq.current) return
    if (!data) return setStatus('error')
    setRows(data)
    setHasMore(data.length === PAGE)
    setStatus('ready')
  }, [user, page])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    document.title = `${t('leads.headlinePre')} ${t('leads.headlineEm')} | ${t('common.appName')}`
  }, [t])
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (editing && !d.open) d.showModal()
    if (!editing && d.open) d.close()
  }, [editing])

  if (ready && !user) return <Navigate to="/login?next=/leads" replace />

  const openForm = (lead) => {
    setFormError(null)
    setForm(lead === 'new' ? EMPTY : { name: lead.name ?? '', phone: lead.phone ?? '', email: lead.email ?? '', notes: lead.notes ?? '', status: lead.status ?? 'new' })
    setEditing(lead)
  }
  const save = async (e) => {
    e.preventDefault()
    const { row, error } = leadRow(form)
    if (error) return setFormError(t(`leads.${error}`))
    setBusy(true)
    const res = editing === 'new'
      ? await supabase.from('leads').insert({ ...row, agent_id: user.id }).select('*').single()
      : await supabase.from('leads').update(row).eq('id', editing.id).select('*').single()
    setBusy(false)
    if (res.error) return setFormError(t('leads.saveFailed'))
    setRows((l) => (editing === 'new' ? [res.data, ...l] : l.map((x) => (x.id === res.data.id ? res.data : x))))
    setEditing(null)
  }
  const setLeadStatus = async (lead, next) => {
    setListFailed(false)
    const { error } = await supabase.from('leads').update({ status: next }).eq('id', lead.id)
    if (error) return setListFailed(true)
    setRows((l) => l.map((x) => (x.id === lead.id ? { ...x, status: next } : x)))
  }
  const remove = async (lead) => {
    if (!window.confirm(`${t('leads.deleteTitle')}\n\n${t('leads.deleteBody', { name: lead.name })}`)) return
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (error) return window.alert(t('leads.deleteFailed'))
    setRows((l) => l.filter((x) => x.id !== lead.id))
  }
  const more = async () => {
    setListFailed(false)
    const data = await page(rows.length)
    if (!data) return setListFailed(true)
    setRows((l) => [...l, ...data.filter((d) => !l.some((x) => x.id === d.id))])
    setHasMore(data.length === PAGE)
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page container section narrow">
      <div className="section-head">
        <div>
          <p className="muted small">{t('leads.kicker')}</p>
          <h1 className="page-title">{t('leads.headlinePre')} {t('leads.headlineEm')}</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openForm('new')}>
          <Plus size={18} aria-hidden="true" />
          {t('leads.add')}
        </button>
      </div>
      <label className="search-input">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('leads.search')} aria-label={t('leads.search')} />
      </label>
      <div className="tabs" role="tablist">
        {['all', ...LEAD_STATUSES].map((s) => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} className={filter === s ? 'is-on' : ''} onClick={() => setFilter(s)}>
            {s === 'all' ? t('leads.all') : t(`leads.status.${s}`)}
          </button>
        ))}
      </div>
      {status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : status === 'loading' ? (
        <ul className="viewings" aria-hidden="true"><li className="viewing is-skeleton" /></ul>
      ) : rows.length === 0 ? (
        search || filter !== 'all' ? <EmptyState title={t('leads.noResults')} /> : <EmptyState title={t('leads.empty')} hint={t('leads.emptyHint')} />
      ) : (
        <>
          <ul className="viewings">
            {rows.map((l) => (
              <li key={l.id} className="viewing">
                <div className="viewing-top">
                  <strong>{l.name}</strong>
                  <Select className="status-select" value={l.status} onChange={(e) => setLeadStatus(l, e.target.value)} aria-label={t('leads.statusLabel')}>
                    {LEAD_STATUSES.map((s) => <option key={s} value={s}>{t(`leads.status.${s}`)}</option>)}
                  </Select>
                </div>
                <p className="muted small">{[l.phone, l.email].filter(Boolean).join(' · ')}</p>
                {l.notes && <p className="viewing-notes">{l.notes}</p>}
                <p className="muted small">{t('leads.added', { date: formatDate(l.created_at, lang) })}</p>
                <div className="row-actions">
                  {l.phone && <a className="btn btn-outline btn-sm" href={telUrl(l.phone)}><Phone size={15} aria-hidden="true" />{t('leads.call')}</a>}
                  {l.phone && <a className="btn btn-outline btn-sm" href={whatsappUrl(l.phone, t('leads.greeting', { name: l.name }))} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} aria-hidden="true" />{t('leads.whatsapp')}</a>}
                  {l.email && <a className="btn btn-outline btn-sm" href={`mailto:${l.email}`}><Mail size={15} aria-hidden="true" />{t('leads.sendEmail')}</a>}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openForm(l)}><Pencil size={15} aria-hidden="true" />{t('leads.editTitle')}</button>
                  <button type="button" className="btn btn-outline btn-sm danger" onClick={() => remove(l)}><Trash2 size={15} aria-hidden="true" />{t('leads.delete')}</button>
                </div>
              </li>
            ))}
          </ul>
          {listFailed && <p className="form-error" role="alert">{t('errors.generic')}</p>}
          {hasMore && <div className="load-more"><button type="button" className="btn btn-outline" onClick={more}>{t('common.loadMore')}</button></div>}
        </>
      )}
      <dialog ref={dialog} className="dialog" onClose={() => setEditing(null)} aria-labelledby="lead-title">
        <form className="dialog-body" onSubmit={save} noValidate>
          <h2 id="lead-title">{editing === 'new' ? t('leads.addTitle') : t('leads.editTitle')}</h2>
          <label className="field"><span>{t('leads.name')}</span><input className="input" value={form.name} onChange={set('name')} maxLength={LEAD_LIMITS.name} autoComplete="off" required /></label>
          <label className="field"><span>{t('leads.phone')}</span><input className="input" type="tel" value={form.phone} onChange={set('phone')} maxLength={LEAD_LIMITS.phone} /></label>
          <label className="field"><span>{t('leads.email')}</span><input className="input" type="email" value={form.email} onChange={set('email')} maxLength={LEAD_LIMITS.email} /></label>
          <label className="field"><span>{t('leads.statusLabel')}</span>
            <Select className="input" value={form.status} onChange={set('status')}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{t(`leads.status.${s}`)}</option>)}
            </Select>
          </label>
          <label className="field"><span>{t('leads.notes')}</span><textarea className="textarea" rows={3} value={form.notes} onChange={set('notes')} maxLength={LEAD_LIMITS.notes} placeholder={t('leads.notesHint')} /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{t('common.save')}</button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

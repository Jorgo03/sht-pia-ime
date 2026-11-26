import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Columns3, Flag, Mail, MessageCircle, Phone, Send, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchPublisher, publisherView } from '@/src/features/properties/lib/publisher.js'
import { pricePerM2 } from '@/src/features/properties/lib/compare.js'
import { priceSteps } from '@/lib/price-history.js'
import { viewingRequestErrorKey } from '@/src/features/viewings/lib/viewingErrors.js'
import { fromTiranaWallTime, tiranaParts } from '@/src/lib/tiranaTime.js'
import { initialsOf } from '@/src/features/properties/lib/discovery.js'
import { supabase } from '../lib/supabase'
import { getProperties } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { FavoriteButton } from './favorites'
import { toggleCompare, useCompare, MAX_COMPARE } from './compare'
import { useCurrency } from './currency'
import ReportDialog from '../components/ReportDialog'
import PropertyCard from '../components/PropertyCard'
import { formatPrice, listingBadgeKey, priceOf, priceSuffixKey, telUrl, whatsappUrl } from '../lib/format'

// The listing page's actions and extra sections, as in the app's
// app/property/[id].tsx. Activity is logged the same way (lib/activity.ts).

const lastView = new Map()
export async function logActivity(propertyId, type) {
  if (type === 'view') {
    if (Date.now() - (lastView.get(propertyId) ?? 0) < 60_000) return
    lastView.set(propertyId, Date.now())
  }
  const { data } = await supabase.auth.getSession()
  await supabase.from('property_activity').insert({ property_id: propertyId, user_id: data.session?.user.id ?? null, type, metadata: {} })
}

const RECENT_KEY = 'fho_recently_viewed'
/** Newest first, ten at most, as in the app's useRecentlyViewed. */
export function addRecentlyViewed(id) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => x !== id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...list].slice(0, 10)))
  } catch {
    // Nothing remembered.
  }
}
export function recentlyViewedIds() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function useRequireSignIn() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return () => navigate(`/login?next=${encodeURIComponent(pathname)}`)
}

/** Next whole half hour, at least an hour ahead, as Tirana wall time for the input. */
function defaultSlot() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  const p = tiranaParts(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

function ViewingDialog({ open, onClose, property, agentId }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const ref = useRef(null)
  const [when, setWhen] = useState(defaultSlot)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const d = ref.current
    if (open && !d.open) {
      setWhen(defaultSlot())
      setResult(null)
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(when)
    if (!m) return
    // The time typed is Tirana time, where the home is, as in the app.
    const at = fromTiranaWallTime(+m[1], +m[2], +m[3], +m[4], +m[5])
    if (at.getTime() < Date.now()) return setResult({ tone: 'error', key: 'viewings.pastDate' })
    setBusy(true)
    const { error } = await supabase.from('viewings').insert({
      property_id: property.id,
      client_id: user.id,
      agent_id: agentId === user.id ? null : agentId,
      scheduled_at: at.toISOString(),
      notes: notes.trim() || null,
    })
    setBusy(false)
    if (error) return setResult({ tone: 'error', key: viewingRequestErrorKey(error) })
    logActivity(property.id, 'meeting')
    setResult({ tone: 'ok', key: 'viewings.requestSuccess' })
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="viewing-title">
      <form className="dialog-body" onSubmit={submit}>
        <h2 id="viewing-title">
          {t('viewings.requestTitle')} {t('viewings.requestTitleEm')}
        </h2>
        {result?.tone === 'ok' ? (
          <p role="status">{t(result.key)}</p>
        ) : (
          <>
            <label className="field">
              <span>{t('viewings.when')}</span>
              <input type="datetime-local" value={when} step={1800} onChange={(e) => setWhen(e.target.value)} required />
              <span className="field-hint">{t('viewings.pickInTiranaTime')}</span>
            </label>
            <label className="field">
              <span>{t('addSheet.notes')}</span>
              <textarea className="textarea" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            {result?.tone === 'error' && <p className="form-error" role="alert">{t(result.key)}</p>}
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
          {result?.tone !== 'ok' && (
            <button type="submit" className="btn btn-primary" disabled={busy}>{t('viewings.request')}</button>
          )}
        </div>
      </form>
    </dialog>
  )
}

export function ContactPanel({ p, title }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user } = useAuth()
  const requireSignIn = useRequireSignIn()
  const compare = useCompare()
  const { currency, formatListingPrice } = useCurrency()
  const converted = !!currency && currency !== (p.currency || 'EUR').toUpperCase()
  const { data: row } = useQuery({ queryKey: ['publisher', p.id], queryFn: () => fetchPublisher(supabase, p.id), staleTime: 300_000, retry: 1 })
  const pub = publisherView(row ?? null, p)
  const agentId = p.agent?.id || p.agent_id || p.owner_id || null
  const own = user && agentId === user.id
  const [message, setMessage] = useState(() => t('property.whatsappMessage', { title }))
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [sendFailed, setSendFailed] = useState(false)
  const [viewingOpen, setViewingOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const suffix = priceSuffixKey(p.listing_type)
  const perM2 = pricePerM2(p)
  const phone = pub.phone?.replace(/\s/g, '') || null
  const inCompare = compare.includes(p.id)

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!user) return requireSignIn()
    const body = message.trim()
    if (!body || !agentId || own || sending) return
    setSending(true)
    setSendFailed(false)
    const find = async () =>
      (await supabase.from('conversations').select('id').eq('property_id', p.id).eq('client_id', user.id).eq('agent_id', agentId).maybeSingle()).data?.id
    try {
      let convo = await find()
      if (!convo) {
        const { data } = await supabase.from('conversations').insert({ property_id: p.id, client_id: user.id, agent_id: agentId }).select('id').single()
        convo = data?.id ?? (await find())
      }
      const { error } = convo ? await supabase.from('messages').insert({ conversation_id: convo, sender_id: user.id, body }) : { error: true }
      if (error) return setSendFailed(true)
      logActivity(p.id, 'message')
      setSent(convo)
      setMessage('')
    } catch {
      setSendFailed(true)
    } finally {
      setSending(false)
    }
  }

  const share = async () => {
    const url = `${window.location.origin}/property/${p.id}`
    try {
      if (navigator.share) return await navigator.share({ title, url })
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Dismissed.
    }
  }

  const profileLink = agentId ? `/${pub.kind === 'agent' ? 'agent' : 'user'}/${agentId}` : null

  return (
    <aside id="contact" className="contact" aria-labelledby="contact-title">
      <div className="contact-top">
        <span className="badge is-inline">{t(listingBadgeKey(p.listing_type))}</span>
        <FavoriteButton property={p} />
      </div>
      <p className="contact-price">
        {formatListingPrice(p.price, p.currency)}
        {suffix && <span className="card-suffix">{t(suffix)}</span>}
      </p>
      {converted && <p className="muted small">{t('currency.converted', { price: priceOf(p, lang) })}</p>}
      {perM2 && (
        <p className="muted">
          {formatPrice(perM2, lang, p.currency)}
          {t('detail.perSqm')}
        </p>
      )}

      {(pub.name || pub.office) && (
        <div className="publisher">
          <span className="agent-initials" aria-hidden="true">{initialsOf(pub.office || pub.name)}</span>
          <div>
            <p className="muted small">{t('detail.publishedBy')}</p>
            {profileLink ? <Link to={profileLink} className="agent-name">{pub.office || pub.name}</Link> : <p className="agent-name">{pub.office || pub.name}</p>}
            {pub.office && pub.name && <p className="muted small">{pub.name}</p>}
          </div>
        </div>
      )}

      <h2 id="contact-title">{t('web.property.contactTitle')}</h2>
      <div className="contact-actions">
        {phone && (
          <a className="btn btn-primary" href={telUrl(phone)} onClick={() => logActivity(p.id, 'call')}>
            <Phone size={18} aria-hidden="true" />
            {t('property.call')}
          </a>
        )}
        {phone && p.whatsapp_enabled !== false && (
          <a className="btn btn-outline" href={whatsappUrl(phone, t('property.whatsappMessage', { title }))} target="_blank" rel="noopener noreferrer" onClick={() => logActivity(p.id, 'message')}>
            <MessageCircle size={18} aria-hidden="true" />
            {t('web.property.whatsapp')}
          </a>
        )}
        {p.contact_email && (
          <a className="btn btn-outline" href={`mailto:${p.contact_email}`}>
            <Mail size={18} aria-hidden="true" />
            {t('web.property.email')}
          </a>
        )}
        {!own && agentId && (
          <button type="button" className="btn btn-outline" onClick={() => (user ? setViewingOpen(true) : requireSignIn())}>
            <CalendarClock size={18} aria-hidden="true" />
            {t('detail.scheduleViewing')}
          </button>
        )}
      </div>

      {!own && agentId && (
        <form className="message-box" onSubmit={sendMessage}>
          <label htmlFor="msg" className="small strong">{t('detail.message')}</label>
          {sent ? (
            <p role="status" className="form-note">
              <Link to={`/messages/${sent}`} className="text-link">{t('web.listing.openChat')}</Link>
            </p>
          ) : (
            <>
              <textarea id="msg" className="textarea" rows={3} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} />
              {sendFailed && <p className="form-error" role="alert">{t('messages.sendFailed')}</p>}
              <button type="submit" className="btn btn-primary" disabled={sending || !message.trim()}>
                <Send size={16} aria-hidden="true" />
                {t('detail.chatInApp')}
              </button>
            </>
          )}
        </form>
      )}

      <div className="contact-tools">
        <button type="button" className="tool" onClick={share}>
          <Share2 size={16} aria-hidden="true" />
          {copied ? t('detail.linkCopied') : t('detail.share')}
        </button>
        <button type="button" className={`tool ${inCompare ? 'is-on' : ''}`} aria-pressed={inCompare} onClick={() => toggleCompare(p.id)} disabled={!inCompare && compare.length >= MAX_COMPARE}>
          <Columns3 size={16} aria-hidden="true" />
          {inCompare ? t('compare.added') : t('compare.add')}
        </button>
        {inCompare && compare.length > 0 && (
          <Link to="/compare" className="tool">{t('web.listing.openCompare', { n: compare.length })}</Link>
        )}
        <button type="button" className="tool" onClick={() => (user ? setReportOpen(true) : requireSignIn())}>
          <Flag size={16} aria-hidden="true" />
          {t('safety.reportListing')}
        </button>
      </div>

      {user && <ViewingDialog open={viewingOpen} onClose={() => setViewingOpen(false)} property={p} agentId={agentId} />}
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} propertyId={p.id} />
    </aside>
  )
}

export function PriceHistory({ propertyId }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { data: steps = [] } = useQuery({
    queryKey: ['price-history', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('property_price_history').select('price, currency, changed_at').eq('property_id', propertyId).order('changed_at', { ascending: true }).limit(100)
      if (error) throw error
      return priceSteps(data ?? [])
    },
  })
  if (steps.length < 2) return null
  return (
    <section aria-labelledby="ph-title">
      <h2 id="ph-title">{t('detail.priceHistory')}</h2>
      <ol className="price-steps">
        {steps.map((s, i) => (
          <li key={s.changed_at + i}>
            <time dateTime={s.changed_at}>{new Date(s.changed_at).toLocaleDateString(lang)}</time>
            <strong>{formatPrice(s.price, lang, s.currency)}</strong>
            {i === 0 ? <span className="muted">{t('detail.priceListed')}</span> : s.change != null && (
              <span className={s.change < 0 ? 'down' : 'up'}>{`${s.change > 0 ? '+' : ''}${Math.round(s.change * 1000) / 10}%`}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SimilarHomes({ p }) {
  const { t } = useTranslation()
  const { data = [] } = useQuery({
    queryKey: ['similar', p.id],
    queryFn: () => getProperties({ propertyType: p.property_type, city: p.city }, 0, 8),
  })
  const homes = data.filter((h) => h.id !== p.id).slice(0, 4)
  if (!homes.length) return null
  return (
    <section aria-labelledby="similar-title" className="similar">
      <h2 id="similar-title">{t('property.similar')}</h2>
      <div className="grid">
        {homes.map((h) => (
          <PropertyCard key={h.id} property={h} />
        ))}
      </div>
    </section>
  )
}

import { memo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Maximize2, MessageSquarePlus, RefreshCw, Send, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MAX_QUESTION_CHARS, fromStored, historyFor, storageKey, toStored } from '@/src/features/assistant/lib/conversation.js'
import { formatPrice } from '@/src/lib/format.js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import PropertyCard from '../../components/PropertyCard'
import EraAvatar from './EraAvatar'

// The app's assistant (app/assistant.tsx, docs/AI_ASSISTANT.md) for the web:
// ask for homes in plain words, get real listings back, compare them, or ask
// how the site works. Every listing, price and comparison comes from the
// database on the server (the ai-assistant Edge Function); this page only
// shows them. The conversation stays in this browser for 30 days, per account.

const STARTERS = ['findApartment', 'byBudget', 'compare', 'howItWorks', 'publish']

// The server names app routes; these are the website's addresses for them.
const WEB_ROUTE = { '/explore': '/search', '/profile': '/account', '/listing/create': '/listing/new' }
const webRoute = (route) => WEB_ROUTE[route] ?? route

let counter = 0
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`

const read = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private windows can refuse storage; the chat still works for this visit.
  }
}

async function classify(error) {
  const context = error?.context
  if (!context || typeof context.json !== 'function') return 'network'
  try {
    const body = await context.json()
    if (body?.error === 'rate_limited') return 'rate_limited'
    if (body?.error === 'refused') return 'refused'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

async function askAssistant({ messages, question, state, language, propertyId }) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { messages: historyFor(messages, question), state, language, property_id: propertyId ?? null },
    })
    if (error) return { ok: false, error: await classify(error) }
    if (typeof data?.reply !== 'string') return { ok: false, error: 'unavailable' }
    return {
      ok: true,
      answer: {
        reply: data.reply,
        cards: Array.isArray(data.cards) ? data.cards : [],
        comparison: data.comparison && Array.isArray(data.comparison.items) ? data.comparison : null,
        screens: Array.isArray(data.screens) ? data.screens : [],
        state: data.state ?? null,
      },
    }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/**
 * Era, the site's assistant, as the full /assistant page (`variant="page"`)
 * or the chat window behind the bottom-right button (`variant="panel"`).
 * Both read and write the same saved conversation.
 */
export default function EraChat({ variant = 'page', propertyId = null, initialText = '', onClose, inputRef }) {
  const { t, i18n } = useTranslation()
  const { user, ready } = useAuth()
  const key = storageKey(user?.id)
  const panel = variant === 'panel'

  const [messages, setMessages] = useState([])
  const [state, setState] = useState(null)
  const [text, setText] = useState(initialText.slice(0, MAX_QUESTION_CHARS))
  const [sending, setSending] = useState(false)
  const [restoredKey, setRestoredKey] = useState(null)
  const endRef = useRef(null)
  const restored = restoredKey === key
  // The conversation an answer belongs to: one that arrives after the person
  // signed in or out is dropped rather than added to the other account's chat.
  const keyRef = useRef(key)
  useEffect(() => {
    keyRef.current = key
  }, [key])

  useEffect(() => {
    if (!panel) document.title = `${t('era.name')} · ${t('aiAssistant.title')} | ${t('common.appName')}`
  }, [t, panel])

  // The first time the window opens the chat arrives a moment later; on a
  // computer the cursor goes straight to the message box.
  useEffect(() => {
    if (panel && window.matchMedia('(pointer: fine)').matches) inputRef?.current?.focus()
  }, [panel, inputRef])

  // Restore this account's conversation once auth is known; a new account
  // starts empty. Done while rendering so the old account's chat never shows.
  if (ready && restoredKey !== key) {
    const saved = fromStored(read(key))
    setMessages(saved?.messages ?? [])
    setState(saved?.state ?? null)
    setRestoredKey(key)
  }

  useEffect(() => {
    if (restored) write(key, JSON.stringify(toStored(messages, state)))
  }, [key, messages, state, restored])

  useEffect(() => {
    if (messages.length || sending) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, sending])

  const ask = async (question, before) => {
    const askedFor = key
    setSending(true)
    const result = await askAssistant({ messages: before, question, state, language: i18n.resolvedLanguage, propertyId })
    setSending(false)
    if (keyRef.current !== askedFor) return
    if (result.ok) {
      const a = result.answer
      setState(a.state)
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: a.reply, cards: a.cards, comparison: a.comparison, screens: a.screens }])
    } else {
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: '', failed: result.error }])
    }
  }

  const send = (raw) => {
    const question = (raw ?? text).trim().slice(0, MAX_QUESTION_CHARS)
    if (!question || sending || !restored) return
    const before = messages
    setMessages([...before, { id: nextId(), role: 'user', content: question }])
    setText('')
    void ask(question, before)
  }

  // Asks the failed question again, in place of the failed answer.
  const retry = (failedId) => {
    if (sending) return
    const index = messages.findIndex((m) => m.id === failedId)
    const question = messages[index - 1]
    if (index < 1 || question?.role !== 'user') return
    setMessages(messages.slice(0, index))
    void ask(question.content, messages.slice(0, index - 1))
  }

  const newChat = () => {
    if (sending) return
    setMessages([])
    setState(null)
    setText('')
    write(key, null)
  }

  const empty = messages.length === 0

  const Heading = panel ? 'h2' : 'h1'
  return (
    <div className={panel ? 'era-panel-body' : 'page container section narrow assistant'}>
      <header className={panel ? 'era-head' : 'assistant-head'}>
        <div className="era-who">
          <EraAvatar size={panel ? 44 : 64} />
          <div>
            <Heading id={panel ? 'era-title' : undefined} className={panel ? 'era-name' : 'page-title'}>{t('era.name')}</Heading>
            <p className="muted era-role">{t('era.role')}</p>
          </div>
        </div>
        <div className="era-actions">
          {!empty && (
            <button type="button" className={panel ? 'nav-icon' : 'btn btn-outline btn-sm'} onClick={newChat} disabled={sending} aria-label={t('aiAssistant.newChat')} title={t('aiAssistant.newChat')}>
              <MessageSquarePlus size={panel ? 19 : 16} aria-hidden="true" />
              {!panel && t('aiAssistant.newChat')}
            </button>
          )}
          {panel && (
            <>
              <Link to="/assistant" className="nav-icon era-expand" aria-label={t('era.openFull')} title={t('era.openFull')}>
                <Maximize2 size={18} aria-hidden="true" />
              </Link>
              <button type="button" className="nav-icon" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
                <X size={20} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="chat" aria-live="polite">
        <Bubble role="assistant">{t('era.intro')}</Bubble>

        {empty && restored && (
          <div className="starters">
            <p className="eyebrow">{t('aiAssistant.startersTitle')}</p>
            {STARTERS.map((s) => (
              <button key={s} type="button" className="starter" onClick={() => send(t(`aiAssistant.starters.${s}`))} disabled={sending}>
                <Sparkles size={15} aria-hidden="true" />
                {t(`aiAssistant.starters.${s}`)}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <Bubble key={m.id} role="user">{m.content}</Bubble>
          ) : m.failed ? (
            <Bubble key={m.id} role="assistant">
              <p>{t(`aiAssistant.error.${m.failed}`)}</p>
              <button type="button" className="link-btn retry" onClick={() => retry(m.id)} disabled={sending}>
                <RefreshCw size={15} aria-hidden="true" />
                {t('common.retry')}
              </button>
            </Bubble>
          ) : (
            <Answer key={m.id} message={m} />
          ),
        )}

        {sending && (
          <Bubble role="assistant">
            <span className="thinking"><span className="dot-pulse" aria-hidden="true" />{t('aiAssistant.thinking')}</span>
          </Bubble>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          ref={inputRef}
          className="textarea"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('aiAssistant.placeholder')}
          aria-label={t('aiAssistant.placeholder')}
          maxLength={MAX_QUESTION_CHARS}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter keeps a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button type="submit" className="send" disabled={sending || !text.trim()} aria-label={t('common.send')}>
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="disclaimer">{t('aiAssistant.disclaimer')}</p>
    </div>
  )
}

function Bubble({ role, children }) {
  const { t } = useTranslation()
  return (
    <div className={`bubble${role === 'user' ? ' is-mine' : ''}`}>
      <span className="visually-hidden">{role === 'user' ? t('aiAssistant.you') : t('era.name')}: </span>
      {children}
    </div>
  )
}

const Answer = memo(function Answer({ message }) {
  const { t } = useTranslation()
  const cards = message.cards ?? []
  const screens = message.screens ?? []
  return (
    <div className="answer">
      <Bubble role="assistant"><p className="answer-text">{message.content}</p></Bubble>
      {cards.length > 0 && (
        <section aria-label={t('aiAssistant.results', { count: cards.length })}>
          <p className="eyebrow">{t('aiAssistant.results', { count: cards.length })}</p>
          <div className="grid grid-2">
            {cards.map((card) => <PropertyCard key={card.id} property={card} />)}
          </div>
        </section>
      )}
      {message.comparison?.items?.length > 1 && <ComparisonTable comparison={message.comparison} />}
      {screens.length > 0 && (
        <div className="screen-links">
          {screens.map((s) =>
            s.route === '/privacy' || s.route === '/terms' ? (
              <a key={s.key} className="screen-link" href={s.route}>{t(`aiAssistant.screens.${s.key}`)}<ArrowRight size={15} aria-hidden="true" /></a>
            ) : (
              <Link key={s.key} className="screen-link" to={webRoute(s.route)}>{t(`aiAssistant.screens.${s.key}`)}<ArrowRight size={15} aria-hidden="true" /></Link>
            ),
          )}
        </div>
      )}
    </div>
  )
})

// Listings side by side, from the numbers the server read from the database
// (ai-assistant/logic.js compareRows); a missing value says so.
function ComparisonTable({ comparison }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const none = t('aiAssistant.notSpecified')
  const mixed = comparison.mixed_currencies
  const money = (v, c) => (v == null ? none : formatPrice(v, lang, c))
  const rows = [
    {
      key: 'price',
      label: t('aiAssistant.compare.price'),
      cell: (i) => money(i.price, i.currency) + (mixed && i.currency !== 'EUR' && i.price_eur_approx ? ` ≈ ${formatPrice(i.price_eur_approx, lang, 'EUR')}` : ''),
      best: comparison.best.lowest_price,
    },
    {
      key: 'perM2',
      label: t('aiAssistant.compare.pricePerM2'),
      cell: (i) => (mixed ? (i.price_per_m2_eur_approx == null ? none : `≈ ${formatPrice(i.price_per_m2_eur_approx, lang, 'EUR')}`) : money(i.price_per_m2, i.currency)),
      best: comparison.best.lowest_price_per_m2,
    },
    { key: 'area', label: t('aiAssistant.compare.area'), cell: (i) => (i.area_m2 == null ? none : `${i.area_m2} m²`), best: comparison.best.largest_area },
    { key: 'beds', label: t('aiAssistant.compare.bedrooms'), cell: (i) => (i.bedrooms == null ? none : String(i.bedrooms)), best: comparison.best.most_bedrooms },
    { key: 'baths', label: t('aiAssistant.compare.bathrooms'), cell: (i) => (i.bathrooms == null ? none : String(i.bathrooms)) },
    {
      key: 'floor',
      label: t('aiAssistant.compare.floor'),
      cell: (i) => (i.floor == null ? none : i.building_floors ? t('aiAssistant.compare.floorOf', { floor: i.floor, total: i.building_floors }) : String(i.floor)),
    },
    { key: 'place', label: t('aiAssistant.compare.location'), cell: (i) => [i.zone, i.city].filter(Boolean).join(', ') || none },
    { key: 'features', label: t('aiAssistant.compare.amenities'), cell: (i) => (i.features?.length ? i.features.map((f) => t(`listing.feature.${f}`, f)).join(', ') : none) },
  ]
  return (
    <div className="ai-compare">
      <div className="compare-scroll">
        <table className="compare">
          <caption className="visually-hidden">{t('aiAssistant.compare.title')}</caption>
          <thead>
            <tr>
              <td />
              {comparison.items.map((item) => (
                <th key={item.id} scope="col"><Link to={`/property/${item.id}`}>{item.title}</Link></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {comparison.items.map((item) => {
                  const best = row.best === item.id
                  return (
                    <td key={item.id} className={best ? 'is-best' : undefined}>
                      {row.cell(item)}
                      {best && <span className="best-note">{t(`aiAssistant.compare.best.${row.key}`)}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {mixed ? `${t('aiAssistant.compare.mixedCurrencies')} ` : ''}
        {t('aiAssistant.compare.areaNote')}
      </p>
    </div>
  )
}

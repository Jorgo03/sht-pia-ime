import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { assistantHistory } from '@/src/features/properties/lib/assistantHistory.js'
import { supabase } from '../lib/supabase'

// The app's per-listing chat (components/property/listing-assistant.tsx):
// answers from this one listing only, through the ai-listing-assistant Edge
// Function. When the listing does not say, the visitor is pointed to the
// seller rather than left with a dead end.
async function askListing(propertyId, messages, language) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-listing-assistant', { body: { property_id: propertyId, messages, language } })
    if (error || !data) return null
    const contact = data.contact === true
    const reply = typeof data.reply === 'string' && data.reply.trim() ? data.reply : null
    if (!reply && !contact) return null
    return { reply, contact }
  } catch {
    return null
  }
}

// Keyed by the listing id where it is used, so another listing starts a fresh chat.
export default function ListingAssistant({ property }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && messages.length) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, thinking, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const send = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || thinking) return
    const history = assistantHistory(messages, content)
    setMessages((prev) => [...prev, { role: 'user', content }])
    setText('')
    setThinking(true)
    const answer = await askListing(property.id, history, i18n.resolvedLanguage)
    setThinking(false)
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: answer?.reply ?? t(answer ? 'assistant.notInListing' : 'assistant.unavailable'),
        failed: answer == null,
        contact: answer == null || answer.contact,
      },
    ])
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-outline ask-home" onClick={() => setOpen(true)}>
        <Sparkles size={16} aria-hidden="true" />
        {t('assistant.fabLabel')}
      </button>
    )
  }

  return (
    <section className="panel listing-chat" aria-labelledby="listing-chat-title">
      <div className="panel-head">
        <div>
          <h2 id="listing-chat-title" className="panel-title">{t('assistant.title')}</h2>
          <p className="muted small">{t('assistant.subtitle')}</p>
        </div>
        <button type="button" className="nav-icon" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="chat" aria-live="polite">
        <div className="bubble">{t('assistant.intro')}</div>
        {/* Searching beyond this listing is the full assistant's job: it opens with the question ready. */}
        <Link className="link-btn" to={`/assistant?property=${property.id}&q=${encodeURIComponent(t('aiAssistant.alternativesQuestion'))}`}>
          <Sparkles size={15} aria-hidden="true" />
          {t('aiAssistant.alternatives')}
        </Link>
        {messages.map((m, i) => (
          <div key={i} className="turn">
            <div className={`bubble${m.role === 'user' ? ' is-mine' : ''}`}>{m.content}</div>
            {m.contact && (
              <a className="link-btn" href="#contact">{t('assistant.contactTitle')}</a>
            )}
          </div>
        ))}
        {thinking && <div className="bubble"><span className="thinking"><span className="dot-pulse" aria-hidden="true" />{t('assistant.thinking')}</span></div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={send}>
        <input ref={inputRef} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')} maxLength={1000} />
        <button type="submit" className="send" disabled={thinking || !text.trim()} aria-label={t('common.send')}>
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="disclaimer">{t('assistant.disclaimer')}</p>
    </section>
  )
}

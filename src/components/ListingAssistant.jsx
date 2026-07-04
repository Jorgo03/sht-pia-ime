import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, X, Send } from 'lucide-react'
import { askListingAssistant } from '../lib/ai'

// Feature C — per-listing buyer assistant. Grounded server-side in this
// listing's data only; the edge function refuses questions outside it.
export default function ListingAssistant({ property }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, thinking, open])

  // Reset the conversation when the listing changes.
  useEffect(() => { setMessages([]); setOpen(false) }, [property?.id])

  if (!property) return null

  const send = async () => {
    const content = text.trim()
    if (!content || thinking) return
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setText('')
    setThinking(true)
    const reply = await askListingAssistant(property.id, history, i18n.language)
    setThinking(false)
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: reply ?? t('assistant.unavailable'), failed: reply == null },
    ])
  }

  if (!open) {
    return (
      <button className="assistant-fab" onClick={() => setOpen(true)} aria-label={t('assistant.title')}>
        <Sparkles size={18} />
        <span>{t('assistant.fabLabel')}</span>
      </button>
    )
  }

  return (
    <div className="assistant-panel">
      <div className="assistant-panel__head">
        <Sparkles size={15} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="assistant-panel__title">{t('assistant.title')}</div>
          <div className="assistant-panel__sub">{t('assistant.subtitle')}</div>
        </div>
        <button className="assistant-panel__close" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          <X size={16} />
        </button>
      </div>

      <div className="assistant-panel__scroll">
        <div className="assistant-msg">{t('assistant.intro')}</div>
        {messages.map((m, i) => (
          <div key={i} className={`assistant-msg ${m.role === 'user' ? 'mine' : ''}`}>{m.content}</div>
        ))}
        {thinking && <div className="assistant-msg assistant-msg--thinking">{t('assistant.thinking')}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="assistant-panel__input">
        <input
          type="text"
          value={text}
          placeholder={t('assistant.placeholder')}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={thinking || !text.trim()} aria-label={t('common.send')}>
          <Send size={14} />
        </button>
      </div>
      <div className="assistant-panel__disclaimer">{t('assistant.disclaimer')}</div>
    </div>
  )
}

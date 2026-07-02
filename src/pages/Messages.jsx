import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle, ArrowLeft, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatRelativeTime, getLocalizedText } from '../lib/format'

export default function Messages() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, isAgent } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('c')

  const [conversations, setConversations] = useState([])
  const [profiles, setProfiles] = useState({})
  const [properties, setProperties] = useState({})
  const [loading, setLoading] = useState(true)

  const loadConversations = useCallback(async () => {
    if (!user) { setConversations([]); setLoading(false); return }
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
    const convos = data ?? []
    setConversations(convos)

    const otherIds = [...new Set(convos.map(c => (c.client_id === user.id ? c.agent_id : c.client_id)))]
    const propIds = [...new Set(convos.map(c => c.property_id).filter(Boolean))]
    const [profRes, propRes] = await Promise.all([
      otherIds.length
        ? supabase.from('profiles').select('id, full_name, agency_name, avatar_url').in('id', otherIds)
        : Promise.resolve({ data: [] }),
      propIds.length
        ? supabase.from('properties').select('id, title, title_i18n').in('id', propIds)
        : Promise.resolve({ data: [] }),
    ])
    setProfiles(Object.fromEntries((profRes.data ?? []).map(p => [p.id, p])))
    setProperties(Object.fromEntries((propRes.data ?? []).map(p => [p.id, p])))
    setLoading(false)
  }, [user])

  useEffect(() => { loadConversations() }, [loadConversations])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('messages-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadConversations)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadConversations])

  if (!user) {
    return (
      <div className="page">
        <div className="placeholder-card">
          <div className="icon"><MessageCircle size={24} /></div>
          <div>{t('messages.loginPrompt')}</div>
        </div>
      </div>
    )
  }

  const active = conversations.find(c => c.id === activeId)
  if (active) {
    const otherId = active.client_id === user.id ? active.agent_id : active.client_id
    return (
      <Thread
        conversation={active}
        other={profiles[otherId]}
        property={active.property_id ? properties[active.property_id] : null}
        meIsClient={active.client_id === user.id}
        userId={user.id}
        onBack={() => setSearchParams({}, { replace: true })}
        onOpenProperty={(id) => navigate(`/property/${id}`)}
      />
    )
  }

  const unread = conversations.reduce(
    (s, c) => s + ((c.client_id === user.id ? c.unread_for_client : c.unread_for_agent) ?? 0), 0)

  return (
    <div className="page">
      <div className="screen-head" style={{ padding: 0 }}>
        <div className="screen-kicker">
          <span className="screen-kicker__dash" />
          {isAgent
            ? t('messages.agent.kicker', { leads: conversations.length, newToday: unread })
            : t('messages.client.kicker', { count: conversations.length, unread })}
        </div>
        <h1 className="screen-headline">
          {isAgent
            ? <>{t('messages.agent.headlinePre')} <em>{t('messages.agent.headlineEm')}</em>.</>
            : <>{t('messages.client.headlinePre')} <em>{t('messages.client.headlineEm')}</em>.</>}
        </h1>
      </div>

      {loading ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>
      ) : conversations.length === 0 ? (
        <div className="placeholder-card" style={{ marginTop: 16 }}>
          <div className="icon"><MessageCircle size={24} /></div>
          <div style={{ fontWeight: 500 }}>{t('messages.empty')}</div>
          <div style={{ color: 'var(--fho-text-muted)', fontSize: 13 }}>{t('messages.emptyHint')}</div>
        </div>
      ) : (
        <div className="msg-list">
          {conversations.map(c => {
            const otherId = c.client_id === user.id ? c.agent_id : c.client_id
            const other = profiles[otherId]
            const prop = c.property_id ? properties[c.property_id] : null
            const myUnread = (c.client_id === user.id ? c.unread_for_client : c.unread_for_agent) ?? 0
            const name = other?.full_name || other?.agency_name || '?'
            const propTitle = prop ? (getLocalizedText(prop.title_i18n, i18n.language) || prop.title) : ''
            return (
              <div key={c.id} className={`msg-row ${myUnread > 0 ? 'unread' : ''}`} onClick={() => setSearchParams({ c: c.id })}>
                <div className="msg-avatar" style={{ background: 'linear-gradient(135deg, var(--fho-orange-1), var(--fho-orange-2))' }}>
                  {name[0]?.toUpperCase() || '?'}
                </div>
                <div className="msg-body">
                  <div className="msg-name">{name}</div>
                  <div className="msg-preview">{propTitle}</div>
                </div>
                <div className="msg-meta">
                  <span className="msg-time">{formatRelativeTime(c.last_message_at, i18n.language)}</span>
                  {myUnread > 0 && <span className="msg-dot" />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Thread({ conversation, other, property, meIsClient, userId, onBack, onOpenProperty }) {
  const { t, i18n } = useTranslation()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const markRead = useCallback(() => {
    const patch = meIsClient ? { unread_for_client: 0 } : { unread_for_agent: 0 }
    supabase.from('conversations').update(patch).eq('id', conversation.id).then(() => {})
  }, [conversation.id, meIsClient])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) setMessages(data ?? []) })
    markRead()

    const channel = supabase
      .channel(`thread-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, ({ new: msg }) => {
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
        if (msg.sender_id !== userId) markRead()
      })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [conversation.id, markRead, userId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversation.id, sender_id: userId, body })
      .select('*')
      .single()
    setSending(false)
    if (!error && data) {
      setText('')
      setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]))
    }
  }

  const name = other?.full_name || other?.agency_name || '?'
  const propTitle = property ? (getLocalizedText(property.title_i18n, i18n.language) || property.title) : ''

  return (
    <div className="page msg-thread">
      <div className="msg-thread__head">
        <button className="msg-thread__back" onClick={onBack} aria-label={t('common.back')}><ArrowLeft size={18} /></button>
        <div className="msg-avatar" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--fho-orange-1), var(--fho-orange-2))' }}>
          {name[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="msg-name">{name}</div>
          {property && (
            <div className="msg-preview" style={{ cursor: 'pointer' }} onClick={() => onOpenProperty(property.id)}>
              {propTitle}
            </div>
          )}
        </div>
      </div>

      <div className="msg-thread__scroll">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--fho-text-muted)', fontSize: 13, padding: '2rem 0' }}>
            {t('messages.noMessages')}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`msg-bubble ${m.sender_id === userId ? 'mine' : ''}`}>
            <div className="msg-bubble__body">{m.body}</div>
            <div className="msg-bubble__time">{formatRelativeTime(m.created_at, i18n.language)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="msg-thread__input">
        <input
          type="text"
          value={text}
          placeholder={t('messages.inputPlaceholder')}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={sending || !text.trim()} aria-label={t('common.send')}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

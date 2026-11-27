import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Flag, Paperclip, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isNotFound, loadThreadMessages } from '@/src/features/messaging/lib/thread.js'
import { mergeMessages } from '@/src/features/messaging/lib/catchUp.js'
import { readAttachment, formatBytes } from '@/src/features/messaging/lib/attachments.js'
import { fetchPublicProfile } from '@/src/features/profiles/lib/publicProfile.js'
import { blockUser, isBlockedSendError, loadBlockedIds, unblockUser } from '@/src/features/safety/lib/safety.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, EmptyState } from '../components/States'
import ReportDialog from '../components/ReportDialog'
import { getLocalizedText } from '../lib/format'

// One conversation, as in the app (app/messages/[id].tsx): the newest 200
// messages, live updates, marked read on open and on arrival, block / report,
// and files sent before attachments were switched off still open.

function Attachment({ value }) {
  const { i18n, t } = useTranslation()
  const file = readAttachment(value)
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const path = file?.path
  useEffect(() => {
    if (!path) return
    supabase.storage
      .from('message-attachments')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) setFailed(true)
        else setUrl(data.signedUrl)
      })
      .catch(() => setFailed(true))
  }, [path])
  if (!file) return null
  if (failed) {
    return (
      <span className="bubble-file" role="note">
        <Paperclip size={16} aria-hidden="true" />
        {file.name} · {t('errors.generic')}
      </span>
    )
  }
  if (file.kind === 'image' && url) return <img className="bubble-img" src={url} alt={file.name} loading="lazy" decoding="async" />
  return (
    <a className="bubble-file" href={url ?? undefined} target="_blank" rel="noopener noreferrer" aria-label={t('messages.openAttachment', { name: file.name })}>
      <Paperclip size={16} aria-hidden="true" />
      {file.name} {file.size ? `· ${formatBytes(file.size, i18n.resolvedLanguage)}` : ''}
    </a>
  )
}

export default function Thread() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const [convo, setConvo] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | gone | error
  const [messages, setMessages] = useState([])
  const [other, setOther] = useState({ id: null, name: '' })
  const [home, setHome] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [reporting, setReporting] = useState(false)
  const [reload, setReload] = useState(0)
  const endRef = useRef(null)
  const convoRef = useRef(null)
  const shownId = useRef(id)
  const uid = user?.id

  const markRead = useCallback((c) => {
    const patch = c.client_id === uid ? { unread_for_client: 0 } : { unread_for_agent: 0 }
    supabase.from('conversations').update(patch).eq('id', c.id).then(() => {})
  }, [uid])

  useEffect(() => {
    if (!id || !uid) return
    let cancelled = false
    // Another conversation (a link from one thread to the next): start from
    // empty instead of merging the previous thread's messages into it.
    if (shownId.current !== id) {
      shownId.current = id
      setMessages([])
      setState('loading')
    }
    ;(async () => {
      const { data: c, error } = await supabase.from('conversations').select('id, client_id, agent_id, property_id').eq('id', id).single()
      if (cancelled) return
      if (!c) return setState(error && !isNotFound(error) ? 'error' : 'gone')
      convoRef.current = c
      setConvo(c)
      const otherId = c.client_id === uid ? c.agent_id : c.client_id
      const [profile, prop, blockedIds] = await Promise.all([
        fetchPublicProfile(supabase, otherId).catch(() => null),
        c.property_id ? supabase.from('properties').select('id, title, title_i18n').eq('id', c.property_id).maybeSingle() : { data: null },
        loadBlockedIds(supabase),
      ])
      if (cancelled) return
      setOther({ id: otherId, name: profile?.full_name?.trim() || profile?.agency_name?.trim() || '?', kind: profile?.kind })
      setHome(prop.data)
      setBlocked(blockedIds.has(otherId))
      const { messages: msgs } = await loadThreadMessages(supabase, id)
      if (cancelled) return
      if (!msgs) return setState('error')
      setMessages((prev) => mergeMessages(prev, msgs))
      setState('ready')
      markRead(c)
    })()
    const channel = supabase
      .channel(`web-thread-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, ({ new: msg }) => {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        if (msg.sender_id !== uid && convoRef.current) markRead(convoRef.current)
      })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [id, uid, markRead, reload])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  useEffect(() => {
    document.title = `${other.name || t('common.messages')} | ${t('common.appName')}`
  }, [other.name, t])

  if (ready && !user) return <Navigate to={`/login?next=/messages/${id}`} replace />

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setSendError(null)
    const { data, error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: uid, body }).select('*').single()
    setSending(false)
    if (error || !data) return setSendError(isBlockedSendError(error) ? 'safety.cannotMessage' : 'messages.sendFailed')
    setText('')
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
  }

  const toggleBlock = async () => {
    if (!other.id) return
    if (blocked) {
      if (await unblockUser(supabase, other.id)) setBlocked(false)
      return
    }
    if (!window.confirm(t('safety.blockConfirm', { name: other.name }))) return
    if (await blockUser(supabase, other.id)) setBlocked(true)
  }

  if (state === 'error') {
    return (
      <div className="page container section narrow">
        <p className="state">{t('messages.loadFailed')}</p>
        <ErrorState onRetry={() => setReload((n) => n + 1)} />
      </div>
    )
  }
  if (state === 'gone') {
    return (
      <div className="page container section narrow">
        <EmptyState title={t('messages.unavailable')}>
          <Link to="/messages" className="btn btn-primary">
            {t('common.messages')}
          </Link>
        </EmptyState>
      </div>
    )
  }

  const homeTitle = home ? getLocalizedText(home.title_i18n, lang) || home.title : null

  return (
    <div className="page container section-tight narrow thread">
      <header className="thread-head">
        <Link to="/messages" className="nav-icon" aria-label={t('common.back')}>
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className="thread-who">
          <h1>{other.id ? <Link to={`/${other.kind === 'agent' ? 'agent' : 'user'}/${other.id}`}>{other.name}</Link> : ' '}</h1>
          {homeTitle && <Link to={`/property/${home.id}`}>{homeTitle}</Link>}
        </div>
        <button type="button" className="nav-icon" onClick={toggleBlock} aria-label={blocked ? t('safety.unblockUser') : t('safety.blockUser')} title={blocked ? t('safety.unblockUser') : t('safety.blockUser')}>
          <Ban size={18} aria-hidden="true" />
        </button>
        <button type="button" className="nav-icon" onClick={() => setReporting(true)} aria-label={t('safety.reportUser')} title={t('safety.reportUser')}>
          <Flag size={18} aria-hidden="true" />
        </button>
      </header>
      {blocked && <p className="form-note">{t('safety.blocked')}</p>}
      <ol className="bubbles" aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'ready' && messages.length === 0 && <li className="state">{t('messages.noMessages')}</li>}
        {messages.map((m) => (
          <li key={m.id} className={`bubble ${m.sender_id === uid ? 'is-mine' : ''}`}>
            {m.attachment && <Attachment value={m.attachment} />}
            {m.body && <p>{m.body}</p>}
            <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })}</time>
          </li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ol>
      <form className="composer" onSubmit={send}>
        <textarea
          className="textarea"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Not the Enter that confirms an IME composition (Chinese, Japanese…).
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e)
          }}
          placeholder={t('messages.inputPlaceholder')}
          aria-label={t('messages.inputPlaceholder')}
          maxLength={4000}
          disabled={blocked}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || sending || blocked} aria-label={t('detail.message')}>
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
      {sendError && <p className="form-error" role="alert">{t(sendError)}</p>}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={other.id} conversationId={id} />
    </div>
  )
}

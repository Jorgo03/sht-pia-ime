import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { loadBlockedIds } from '@/src/features/safety/lib/safety.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'
import { getLocalizedText } from '../lib/format'
import { formatRelativeTime } from '@/src/lib/format.js'

// The inbox, as in the app (app/(tabs)/messages.tsx): the person's
// conversations, newest first, with the other side's name, the home it is
// about and the unread count; kept current by a realtime subscription.

const PAGE = 50

export default function Messages() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const [state, setState] = useState({ status: 'loading', convos: [], profiles: {}, homes: {}, blocked: new Set() })

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
      .limit(PAGE)
    if (error) return setState((s) => ({ ...s, status: 'error' }))
    const convos = data ?? []
    const others = [...new Set(convos.map((c) => (c.client_id === user.id ? c.agent_id : c.client_id)))]
    const propIds = [...new Set(convos.map((c) => c.property_id).filter(Boolean))]
    const [prof, props, blocked] = await Promise.all([
      others.length ? supabase.from('profiles').select('id, full_name, agency_name, avatar_url').in('id', others) : { data: [] },
      propIds.length ? supabase.from('properties').select('id, title, title_i18n, image_urls').in('id', propIds) : { data: [] },
      loadBlockedIds(supabase),
    ])
    setState({
      status: 'ready',
      convos,
      profiles: Object.fromEntries((prof.data ?? []).map((p) => [p.id, p])),
      homes: Object.fromEntries((props.data ?? []).map((p) => [p.id, p])),
      blocked,
    })
  }, [user])

  useEffect(() => {
    document.title = `${t('common.messages')} | ${t('common.appName')}`
  }, [t])

  useEffect(() => {
    if (!user) return
    load()
    const channel = supabase
      .channel(`web-inbox-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, load])

  if (ready && !user) return <Navigate to="/login?next=/messages" replace />

  const { status, convos, profiles, homes, blocked } = state

  return (
    <div className="page container section narrow">
      <div className="section-head">
        <div>
          <h1 className="page-title">{t('common.messages')}</h1>
          <p>{t('messages.subtitle')}</p>
        </div>
      </div>
      {status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : status === 'loading' ? (
        <ul className="inbox" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="inbox-row is-skeleton" />
          ))}
        </ul>
      ) : convos.length === 0 ? (
        <EmptyState title={t('messages.empty')} hint={t('messages.emptyHint')}>
          <Link to="/search" className="btn btn-primary">
            {t('site.cta.search')}
          </Link>
        </EmptyState>
      ) : (
        <ul className="inbox">
          {convos.map((c) => {
            const isClient = c.client_id === user.id
            const otherId = isClient ? c.agent_id : c.client_id
            const other = profiles[otherId]
            const name = other?.full_name?.trim() || other?.agency_name?.trim() || '?'
            const home = homes[c.property_id]
            const unread = isClient ? c.unread_for_client : c.unread_for_agent
            return (
              <li key={c.id}>
                <Link to={`/messages/${c.id}`} className={`inbox-row ${unread ? 'is-unread' : ''}`}>
                  {home?.image_urls?.[0] ? (
                    <img src={home.image_urls[0]} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="inbox-icon">
                      <MessageCircle size={20} aria-hidden="true" />
                    </span>
                  )}
                  <span className="inbox-main">
                    <span className="inbox-name">
                      {name}
                      {blocked.has(otherId) && <span className="pill">{t('safety.blockedBadge')}</span>}
                    </span>
                    {home && <span className="inbox-home">{getLocalizedText(home.title_i18n, lang) || home.title}</span>}
                  </span>
                  <span className="inbox-meta">
                    <time dateTime={c.last_message_at}>{formatRelativeTime(c.last_message_at, lang)}</time>
                    {unread > 0 && <span className="count">{unread}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { notificationCopy, notificationRoute } from '@/src/features/notifications/lib/feed.js'
import { formatRelativeTime } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'

const PAGE = 30

// Notifications, as in the app (app/notifications.tsx): all / unread / read,
// mark one or all read, live updates, and a tap opens what it is about.
export default function Notifications() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [hasMore, setHasMore] = useState(false)
  const seq = useRef(0)

  const page = useCallback(
    (from, to) => {
      let q = supabase.from('notifications').select('id, kind, data, read_at, created_at').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }).range(from, to)
      if (filter === 'unread') q = q.is('read_at', null)
      if (filter === 'read') q = q.not('read_at', 'is', null)
      return q
    },
    [user?.id, filter],
  )

  const load = useCallback(async () => {
    if (!user) return
    const run = ++seq.current
    const { data, error } = await page(0, PAGE - 1)
    if (run !== seq.current) return
    if (error) return setStatus('error')
    setItems(data ?? [])
    setHasMore((data ?? []).length === PAGE)
    setStatus('ready')
  }, [user, page])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel(`web-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [user, load])
  useEffect(() => {
    document.title = `${t('notifications.headlinePre')} ${t('notifications.headlineEm')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to="/login?next=/notifications" replace />

  const markRead = async (id) => {
    const at = new Date().toISOString()
    setItems((l) => l.map((n) => (n.id === id ? { ...n, read_at: at } : n)))
    await supabase.from('notifications').update({ read_at: at }).eq('id', id)
  }
  const markAll = async () => {
    const at = new Date().toISOString()
    setItems((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: at })))
    await supabase.from('notifications').update({ read_at: at }).eq('user_id', user.id).is('read_at', null)
  }
  const more = async () => {
    const { data } = await page(items.length, items.length + PAGE - 1)
    const seen = new Set(items.map((n) => n.id))
    setItems((l) => [...l, ...(data ?? []).filter((n) => !seen.has(n.id))])
    setHasMore((data ?? []).length === PAGE)
  }
  const open = (n) => {
    if (!n.read_at) markRead(n.id)
    const route = notificationRoute(n)
    if (route) navigate(route)
  }

  const unread = items.filter((n) => !n.read_at).length
  const empty = filter === 'unread' ? t('notifications.emptyUnread') : filter === 'read' ? t('notifications.emptyRead') : t('notifications.empty')

  return (
    <div className="page container section narrow">
      <div className="section-head">
        <h1 className="page-title">{t('notifications.headlinePre')} {t('notifications.headlineEm')}</h1>
        {unread > 0 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={markAll}>
            <CheckCheck size={16} aria-hidden="true" />
            {t('notifications.markAll')}
          </button>
        )}
      </div>
      <div className="tabs" role="tablist">
        {['all', 'unread', 'read'].map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => { setStatus('loading'); setFilter(f) }}>
            {t(`notifications.${f}`)}
          </button>
        ))}
      </div>
      {status === 'error' ? (
        <>
          <p className="state">{t('notifications.loadFailed')}</p>
          <ErrorState onRetry={load} />
        </>
      ) : status === 'loading' ? (
        <ul className="inbox" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className="inbox-row is-skeleton" />)}</ul>
      ) : items.length === 0 ? (
        <EmptyState title={empty} hint={filter === 'all' ? t('notifications.emptyHint') : undefined} />
      ) : (
        <>
          <ul className="inbox">
            {items.map((n) => {
              const { title, body } = notificationCopy(n, t)
              return (
                <li key={n.id} className={`notif ${n.read_at ? '' : 'is-unread'}`}>
                  <button type="button" className="notif-main" onClick={() => open(n)}>
                    <Bell size={18} aria-hidden="true" />
                    <span>
                      <strong>{title}</strong>
                      <span className="muted">{body}</span>
                    </span>
                    <time dateTime={n.created_at}>{formatRelativeTime(n.created_at, lang)}</time>
                  </button>
                  {!n.read_at && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => markRead(n.id)}>
                      {t('notifications.markRead')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <div className="load-more">
              <button type="button" className="btn btn-outline" onClick={more}>{t('notifications.loadMore')}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

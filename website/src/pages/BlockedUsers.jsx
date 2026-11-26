import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchPublicProfile } from '@/src/features/profiles/lib/publicProfile.js'
import { unblockUser } from '@/src/features/safety/lib/safety.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState } from '../components/States'

// The people you blocked, with Unblock, as in the app (app/blocked-users.tsx).
async function fetchBlocked() {
  const { data, error } = await supabase.from('user_blocks').select('blocked_id, created_at').order('created_at', { ascending: false })
  if (error) throw error
  const ids = (data ?? []).map((r) => r.blocked_id)
  const rows = await Promise.all(ids.map((id) => fetchPublicProfile(supabase, id).catch(() => null)))
  return ids.map((id, i) => ({ id, name: rows[i]?.full_name?.trim() || null }))
}

export default function BlockedUsers() {
  const { t } = useTranslation()
  const { user, ready } = useAuth()
  const qc = useQueryClient()
  const key = ['blocked-users', user?.id ?? '']
  const q = useQuery({ queryKey: key, queryFn: fetchBlocked, enabled: !!user, retry: false })
  const [busy, setBusy] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    document.title = `${t('safety.blockedUsers')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to="/login?next=/blocked-users" replace />

  const unblock = async (id) => {
    setBusy(id)
    setFailed(false)
    const ok = await unblockUser(supabase, id)
    setBusy(null)
    if (ok) qc.setQueryData(key, (prev) => (prev ?? []).filter((p) => p.id !== id))
    else setFailed(true)
  }

  return (
    <div className="page container section narrow">
      <Link to="/account" className="text-link back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {t('web.account.title')}
      </Link>
      <h1 className="page-title">{t('safety.blockedUsers')}</h1>
      {failed && <p className="form-error" role="alert">{t('errors.generic')}</p>}
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <ul className="inbox" aria-hidden="true"><li className="inbox-row is-skeleton" /></ul>
      ) : q.data.length === 0 ? (
        <EmptyState title={t('safety.noBlocked')} />
      ) : (
        <ul className="activity">
          {q.data.map((p) => {
            const name = p.name ?? t('publicProfile.unnamed')
            return (
              <li key={p.id}>
                <Link to={`/user/${p.id}`} className="strong">{name}</Link>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy === p.id} onClick={() => unblock(p.id)} aria-label={`${t('safety.unblockUser')}: ${name}`}>
                  {busy === p.id ? t('common.loading') : t('safety.unblockUser')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

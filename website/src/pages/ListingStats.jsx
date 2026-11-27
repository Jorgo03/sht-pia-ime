import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/States'

const DAYS = 30
const TYPES = ['view', 'call', 'message', 'meeting', 'favourite']
// Days in the chart are counted from up to this many events of one kind.
const CHART_CAP = 5000

// One listing's activity over 30 days, as in the app
// (app/listing/[id]/analytics.tsx): totals per kind, a daily chart for the
// chosen kind, and the most recent events.
export default function ListingStats() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, ready } = useAuth()
  const [metric, setMetric] = useState('view')
  const [now] = useState(() => Date.now())
  const since = useMemo(() => new Date(now - DAYS * 864e5).toISOString(), [now])
  // Totals: one exact head count per kind, so they are right however busy
  // the listing is.
  const totals = useQuery({
    queryKey: ['activity-totals', id, since],
    enabled: !!user,
    queryFn: async () => {
      const res = await Promise.all(TYPES.map((k) => supabase.from('property_activity').select('id', { count: 'exact', head: true }).eq('property_id', id).eq('type', k).gte('created_at', since)))
      const failed = res.find((r) => r.error)
      if (failed) throw failed.error
      return Object.fromEntries(TYPES.map((k, i) => [k, res[i].count ?? 0]))
    },
  })
  // The chart reads the chosen kind's events, at most CHART_CAP of them.
  const chart = useQuery({
    queryKey: ['activity-chart', id, metric, since],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('property_activity').select('created_at').eq('property_id', id).eq('type', metric).gte('created_at', since).order('created_at', { ascending: false }).limit(CHART_CAP)
      if (error) throw error
      return data ?? []
    },
  })
  const recent = useQuery({
    queryKey: ['activity-recent', id, since],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('property_activity').select('id, type, created_at').eq('property_id', id).gte('created_at', since).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return data ?? []
    },
  })
  const q = totals.isError ? totals : chart.isError ? chart : recent
  const counts = totals.data
  const activity = useMemo(() => recent.data ?? [], [recent.data])
  const days = useMemo(() => {
    const per = new Map()
    for (const a of chart.data ?? []) per.set(a.created_at.slice(0, 10), (per.get(a.created_at.slice(0, 10)) ?? 0) + 1)
    const list = []
    for (let i = DAYS - 1; i >= 0; i--) {
      const key = new Date(now - i * 864e5).toISOString().slice(0, 10)
      list.push({ key, count: per.get(key) ?? 0 })
    }
    return list
  }, [chart.data, now])
  const max = Math.max(1, ...days.map((d) => d.count))

  useEffect(() => {
    document.title = `${t('dashboard.title')} | ${t('common.appName')}`
  }, [t])

  if (ready && !user) return <Navigate to={`/login?next=/listing/${id}/analytics`} replace />

  return (
    <div className="page container section narrow">
      <Link to="/my-listings" className="text-link back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {t('listing.myListings')}
      </Link>
      <h1 className="page-title">{t('dashboard.title')}</h1>
      {q.isError ? (
        <ErrorState onRetry={() => { totals.refetch(); chart.refetch(); recent.refetch() }} />
      ) : (
        <>
          <div className="stat-grid" role="radiogroup" aria-label={t('dashboard.title')}>
            {TYPES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={metric === k} className={`stat ${metric === k ? 'is-on' : ''}`} onClick={() => setMetric(k)}>
                <strong>{counts ? counts[k] : '–'}</strong>
                <span>{t(`dashboard.${k}s`)}</span>
              </button>
            ))}
          </div>
          <section className="panel" aria-labelledby="chart-title">
            <h2 id="chart-title" className="small strong">{t(`dashboard.${metric}s`)} · {t('dashboard.lastDays', { n: DAYS, defaultValue: '{{n}} d' })}</h2>
            <ol className="bars">
              {days.map((d) => (
                <li key={d.key} title={`${d.key}: ${d.count}`}>
                  <span className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
                  <span className="visually-hidden">{d.key}: {d.count}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel" aria-labelledby="recent-title">
            <h2 id="recent-title" className="small strong">{t('dashboard.recentActivity')}</h2>
            {activity.length === 0 ? (
              <p className="muted">{recent.isPending ? t('common.loading') : t('dashboard.noActivity')}</p>
            ) : (
              <ul className="activity">
                {activity.slice(0, 50).map((a) => (
                  <li key={a.id}>
                    <span>{t(`dashboard.${a.type}s`)}</span>
                    <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

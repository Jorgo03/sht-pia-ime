import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { achievements, compareToBaseline, monthsActive, parseEstimate, PERIODS, periodRange, recentMonths } from '@/src/lib/performanceReport.js'
import { formatDate } from '@/src/lib/format.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/States'
import Select from '../components/Select'

// The agent's private performance report, as in the app
// (app/performance/index.tsx, hooks/use-performance-report.ts): the
// my_performance_report RPC for a period, history by month, a comparison with
// the agent's own "before" estimate, and achievements.

const IMPACT = [
  ['rentals', 'monthly_rentals', (r) => r.deals.rentals_total],
  ['sales', 'monthly_sales', (r) => r.deals.sales_total],
  ['inquiries', 'monthly_inquiries', (r) => r.contact.inquiries_total],
  ['viewings', 'monthly_viewings', (r) => r.viewings.completed_total],
]
const HISTORY = ['listings', 'transactions', 'viewings', 'inquiries']

function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Tirane'
  } catch {
    return 'Europe/Tirane'
  }
}

function Metric({ label, value }) {
  return (
    <div className="stat">
      <strong>{value ?? '–'}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function Performance() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { user, profile, ready } = useAuth()
  const qc = useQueryClient()
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [metric, setMetric] = useState('listings')
  const [editing, setEditing] = useState(false)
  const dialog = useRef(null)
  const range = useMemo(
    () => periodRange(period, new Date(), custom.from && custom.to ? { from: new Date(custom.from), to: new Date(custom.to) } : null),
    [period, custom],
  )
  const from = range?.from ? range.from.toISOString() : null
  const to = range?.to ? range.to.toISOString() : null
  const q = useQuery({
    queryKey: ['performance', user?.id, from, to],
    enabled: !!user && !!range && profile?.role === 'agent',
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_performance_report', { p_from: from, p_to: to, p_tz: timeZone() })
      if (error) throw error
      return data
    },
  })
  const r = q.data

  const [est, setEst] = useState({})
  const [confirmEst, setConfirmEst] = useState(false)
  const [estError, setEstError] = useState(null)
  const save = useMutation({
    mutationFn: async (values) => {
      const { error } = await supabase.from('agent_performance_baselines').upsert({ agent_id: user.id, ...values }, { onConflict: 'agent_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['performance'] })
      setEditing(false)
    },
    onError: () => setEstError(t('performance.baseline.saveFailed')),
  })

  useEffect(() => {
    document.title = `${t('performance.entry')} | ${t('common.appName')}`
  }, [t])
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (editing && !d.open) d.showModal()
    if (!editing && d.open) d.close()
  }, [editing])

  if (ready && !user) return <Navigate to="/login?next=/performance" replace />
  if (ready && profile && profile.role !== 'agent') {
    return <div className="page container section"><p className="state">{t('performance.agentsOnly')}</p></div>
  }

  const openEstimate = () => {
    const b = r?.baseline ?? {}
    setEst(Object.fromEntries(IMPACT.map(([, col]) => [col, b[col] ?? ''])))
    setConfirmEst(false)
    setEstError(null)
    setEditing(true)
  }
  const submitEstimate = (e) => {
    e.preventDefault()
    const values = {}
    for (const [, col] of IMPACT) {
      const v = parseEstimate(est[col])
      if (v === undefined) return setEstError(t('performance.baseline.invalid'))
      values[col] = v
    }
    if (!confirmEst) return setEstError(t('performance.baseline.mustConfirm'))
    save.mutate(values)
  }

  const months = r ? monthsActive(r.since) : 1
  const history = r ? recentMonths(r.monthly) : []
  const top = Math.max(1, ...history.map((m) => m[metric] ?? 0))
  const fmt = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString(lang))
  const signed = (n) => `${n > 0 ? '+' : ''}${Number(n).toLocaleString(lang)}`

  return (
    <div className="page container section narrow">
      <Link to="/agent-dashboard" className="text-link back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {t('agentDashboard.title')}
      </Link>
      <p className="muted small">{t('performance.kicker')}</p>
      <h1 className="page-title">{t('performance.headlinePre')} {t('performance.headlineEm')}</h1>
      <p className="form-note">{t('performance.privateNote')}</p>

      <div className="perf-period">
        <label className="field">
          <span>{t('performance.period')}</span>
          <Select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p} value={p}>{t(`performance.periods.${p}`)}</option>)}
          </Select>
        </label>
        {period === 'custom' && (
          <>
            <label className="field"><span>{t('performance.from')}</span><input className="input" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></label>
            <label className="field"><span>{t('performance.to')}</span><input className="input" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></label>
          </>
        )}
      </div>
      {period === 'custom' && custom.from && custom.to && !range && <p className="form-error" role="alert">{t('performance.customInvalid')}</p>}

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !r ? (
        <div className="stat-grid" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="stat is-skeleton" />)}</div>
      ) : (
        <>
          <section className="perf-section">
            <h2 className="panel-title">{t('performance.sections.properties')}</h2>
            <div className="stat-grid">
              <Metric label={t('performance.metrics.published')} value={fmt(r.listings.published)} />
              <Metric label={t('performance.metrics.activeNow')} value={fmt(r.listings.active_now)} />
              <Metric label={t('performance.metrics.pausedNow')} value={fmt(r.listings.paused_now)} />
            </div>
            <p className="muted small">{t('performance.notes.snapshot')}</p>
          </section>
          <section className="perf-section">
            <h2 className="panel-title">{t('performance.sections.clients')}</h2>
            <div className="stat-grid">
              <Metric label={t('performance.metrics.inquiries')} value={fmt(r.contact.inquiries)} />
              <Metric label={t('performance.metrics.clientsAnswered')} value={fmt(r.contact.clients_answered)} />
              <Metric label={t('performance.metrics.leadsAdded')} value={fmt(r.leads.added)} />
              <Metric label={t('performance.metrics.leadsWon')} value={fmt(r.leads.won)} />
            </div>
            <p className="muted small">{t('performance.notes.leadsWon')}</p>
          </section>
          <section className="perf-section">
            <h2 className="panel-title">{t('performance.sections.deals')}</h2>
            <div className="stat-grid">
              <Metric label={t('performance.metrics.sales')} value={fmt(r.deals.sales)} />
              <Metric label={t('performance.metrics.rentals')} value={fmt(r.deals.rentals)} />
              <Metric label={t('performance.metrics.transactions')} value={fmt(r.deals.sales + r.deals.rentals)} />
            </div>
            <p className="muted small">{t('performance.notes.deals')}</p>
          </section>
          <section className="perf-section">
            <h2 className="panel-title">{t('performance.sections.activity')}</h2>
            <div className="stat-grid">
              <Metric label={t('performance.metrics.viewingsScheduled')} value={fmt(r.viewings.scheduled)} />
              <Metric label={t('performance.metrics.viewingsCompleted')} value={fmt(r.viewings.completed)} />
              <Metric label={t('performance.metrics.viewingsCancelled')} value={fmt(r.viewings.cancelled)} />
              <Metric label={t('performance.metrics.messagesSent')} value={fmt(r.contact.messages_sent)} />
            </div>
          </section>

          <section className="panel" aria-labelledby="history-title">
            <h2 id="history-title" className="panel-title">{t('performance.sections.history')}</h2>
            <p className="muted small">{t('performance.history.since', { date: formatDate(r.since, lang) })}</p>
            <div className="tabs" role="tablist">
              {HISTORY.map((m) => (
                <button key={m} type="button" role="tab" aria-selected={metric === m} className={metric === m ? 'is-on' : ''} onClick={() => setMetric(m)}>
                  {t(`performance.history.${m}`)}
                </button>
              ))}
            </div>
            {history.length === 0 ? (
              <p className="muted">{t('performance.history.empty')}</p>
            ) : (
              <ol className="bars bars-labelled" aria-label={t('performance.history.chartLabel', { metric: t(`performance.history.${metric}`) })}>
                {history.map((m) => (
                  <li key={m.month}>
                    <span className="bar" style={{ height: `${((m[metric] ?? 0) / top) * 100}%` }} />
                    <span className="bar-label">{m.month.slice(2, 7)}</span>
                    <span className="visually-hidden">: {m[metric] ?? 0}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel" aria-labelledby="impact-title">
            <h2 id="impact-title" className="panel-title">{t('performance.sections.impact')}</h2>
            <p className="muted small">{t('performance.impact.intro')}</p>
            <table className="compare impact">
              <thead>
                <tr><th scope="col" /><th scope="col">{t('performance.impact.before')}</th><th scope="col">{t('performance.impact.now')}</th><th scope="col">{t('performance.impact.difference')}</th></tr>
              </thead>
              <tbody>
                {IMPACT.map(([key, col, total]) => {
                  const c = compareToBaseline(r.baseline?.[col] ?? null, total(r), months)
                  return (
                    <tr key={key}>
                      <th scope="row">{t(`performance.impact.rows.${key}`)}</th>
                      <td>{c.previous === null ? <span className="muted">{t('performance.impact.notEntered')}</span> : fmt(c.previous)}</td>
                      <td>{fmt(c.current)}</td>
                      <td>{c.difference === null ? '–' : `${signed(c.difference)}${c.percent !== null ? ` (${signed(c.percent)}%)` : ''}`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {r.baseline?.updated_at && <p className="muted small">{t('performance.impact.updated', { date: formatDate(r.baseline.updated_at, lang) })}</p>}
            <p className="muted small">{t('performance.impact.disclaimer')}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={openEstimate}>
              {r.baseline ? <Pencil size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              {r.baseline ? t('performance.impact.edit') : t('performance.impact.enter')}
            </button>
          </section>

          <section className="panel" aria-labelledby="ach-title">
            <h2 id="ach-title" className="panel-title">{t('performance.sections.achievements')}</h2>
            <ul className="achievements">
              {achievements({ listings: r.listings.published_total, transactions: r.deals.sales_total + r.deals.rentals_total, viewings: r.viewings.completed_total }).map((a) => (
                <li key={a.key} className={a.done ? 'is-done' : ''}>
                  <Trophy size={20} aria-hidden="true" />
                  <span>
                    <strong>{t(`performance.achievements.${a.key}`)}</strong>
                    <span className="muted small">{a.done ? t('performance.achievements.done') : t('performance.achievements.progress', { value: a.progress, target: a.target })}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <dialog ref={dialog} className="dialog" onClose={() => setEditing(false)} aria-labelledby="est-title">
        <form className="dialog-body" onSubmit={submitEstimate} noValidate>
          <h2 id="est-title">{t('performance.baseline.title')}</h2>
          <p className="muted small">{t('performance.baseline.hint')}</p>
          {IMPACT.map(([key, col]) => (
            <label key={col} className="field">
              <span>{t(`performance.impact.rows.${key}`)}</span>
              <input className="input" inputMode="decimal" value={est[col] ?? ''} onChange={(e) => setEst((s) => ({ ...s, [col]: e.target.value }))} />
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={confirmEst} onChange={(e) => setConfirmEst(e.target.checked)} />
            {t('performance.baseline.confirm')}
          </label>
          {estError && <p className="form-error" role="alert">{estError}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>{t('performance.baseline.save')}</button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

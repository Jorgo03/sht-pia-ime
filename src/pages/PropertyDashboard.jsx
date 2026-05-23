import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Phone, MessageCircle, Calendar, Eye, Heart } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'

const TYPES = ['view', 'call', 'message', 'meeting', 'favourite']
const TYPE_ICONS = { call: Phone, message: MessageCircle, meeting: Calendar, view: Eye, favourite: Heart }
const TYPE_COLORS = {
  view: 'var(--fho-dash-view, #3498db)',
  call: 'var(--fho-dash-call, #27ae60)',
  message: 'var(--fho-dash-message, #f39c12)',
  meeting: 'var(--fho-dash-meeting, #8e44ad)',
  favourite: 'var(--fho-dash-favourite, #e74c3c)',
}

export default function PropertyDashboard() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState('view')

  useEffect(() => {
    const since = new Date()
    since.setDate(since.getDate() - 30)

    supabase
      .from('property_activity')
      .select('*')
      .eq('property_id', id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setActivity(data || [])
        setLoading(false)
      })
  }, [id])

  const counts = useMemo(() => {
    const c = {}
    TYPES.forEach(t => { c[t] = 0 })
    activity.forEach(a => { c[a.type] = (c[a.type] || 0) + 1 })
    return c
  }, [activity])

  const chartData = useMemo(() => {
    const days = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days[key] = 0
    }
    activity.filter(a => a.type === metric).forEach(a => {
      const key = a.created_at.slice(0, 10)
      if (key in days) days[key]++
    })
    return Object.entries(days).map(([date, count]) => ({ date: date.slice(5), count }))
  }, [activity, metric])

  const recent = activity.slice(0, 50)

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: '50%', border: '0.5px solid var(--fho-border)', background: 'var(--fho-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>{t('dashboard.title')}</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--fho-text-muted)' }}>{t('common.loading')}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {TYPES.map(type => {
              const Icon = TYPE_ICONS[type]
              return (
                <div key={type} style={{ background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 14, border: '0.5px solid var(--fho-border)', textAlign: 'center' }}>
                  <Icon size={20} style={{ color: TYPE_COLORS[type] }} />
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{counts[type]}</div>
                  <div style={{ fontSize: 11, color: 'var(--fho-text-muted)', textTransform: 'capitalize' }}>{t(`dashboard.${type}s`)}</div>
                </div>
              )
            })}
          </div>

          <div style={{ background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', padding: 16, border: '0.5px solid var(--fho-border)', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setMetric(type)}
                  style={{ padding: '4px 12px', borderRadius: 8, border: metric === type ? 'none' : '0.5px solid var(--fho-border)', background: metric === type ? TYPE_COLORS[type] : 'transparent', color: metric === type ? 'white' : 'var(--fho-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                >{t(`dashboard.${type}s`)}</button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--fho-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fho-text-muted)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--fho-text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--fho-surface)', border: '1px solid var(--fho-border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke={TYPE_COLORS[metric]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', border: '0.5px solid var(--fho-border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--fho-border)', fontWeight: 600, fontSize: 14 }}>{t('dashboard.recentActivity')}</div>
            {recent.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fho-text-muted)', fontSize: 13 }}>{t('dashboard.noActivity')}</div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {recent.map(a => {
                  const Icon = TYPE_ICONS[a.type] || Eye
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid var(--fho-border)' }}>
                      <Icon size={14} style={{ color: TYPE_COLORS[a.type], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, textTransform: 'capitalize', flex: 1 }}>{t(`dashboard.${a.type}s`)}</span>
                      <span style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{formatDate(a.created_at, i18n.language)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

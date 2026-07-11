import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, CalendarDays } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activity'

// Rounds "now + 1h" to the next half hour for the datetime-local default/min.
function nextSlot() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ViewingRequestSheet({ property, onClose, onDone }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [when, setWhen] = useState(nextSlot)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const submit = async () => {
    if (!user || loading) return
    const scheduled = when ? new Date(when) : null
    if (!scheduled || Number.isNaN(scheduled.getTime()) || scheduled.getTime() < Date.now()) {
      setError(t('viewings.pastDate'))
      return
    }
    setLoading(true)
    setError('')
    const agentId = property.agent?.id || property.agent_id || property.owner_id
    const { error: err } = await supabase.from('viewings').insert({
      property_id: property.id,
      client_id: user.id,
      agent_id: agentId === user.id ? null : agentId,
      scheduled_at: scheduled.toISOString(),
      notes: notes.trim() || null,
    })
    setLoading(false)
    if (err) {
      setError(t('viewings.requestFailed'))
      return
    }
    logActivity(property.id, 'meeting')
    onDone()
  }

  return (
    <>
      <div className="addsheet-backdrop" onClick={onClose} />
      <div className="addsheet-panel" role="dialog" aria-label={t('viewings.requestTitle')}>
        <div className="addsheet-grip" />
        <div className="addsheet-header">
          <h2 className="addsheet-title">
            {t('viewings.requestTitle')} <em>{t('viewings.requestTitleEm')}</em>
          </h2>
          <button className="addsheet-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="addsheet-miniform">
          <h3 className="addsheet-miniform__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} /> {t('viewings.when')}
          </h3>
          <input
            className="addsheet-input"
            type="datetime-local"
            value={when}
            min={nextSlot()}
            onChange={(e) => { setWhen(e.target.value); setError('') }}
          />
          <textarea
            className="addsheet-input addsheet-textarea"
            placeholder={t('addSheet.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <div className="nl-error" role="alert">{error}</div>}
          <button className="cta-pill" onClick={submit} disabled={loading || !when}>
            {loading ? t('common.loading') : t('viewings.request')}
          </button>
        </div>
      </div>
    </>
  )
}

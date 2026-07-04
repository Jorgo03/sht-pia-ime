import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, Mail, Building2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import PropertyCard from '../components/PropertyCard'
import SkeletonCard from '../../../shared/SkeletonCard'

export default function AgentProfile() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [agent, setAgent] = useState(null)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)

    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('properties').select('*').eq('agent_id', id).eq('status', 'active').order('created_at', { ascending: false }),
    ]).then(([profileRes, propsRes]) => {
      if (!active) return
      if (profileRes.data) setAgent(profileRes.data)
      if (propsRes.data) setProperties(propsRes.data)
      setLoading(false)
    })

    return () => { active = false }
  }, [id])

  if (loading) return (
    <div className="page">
      <div className="property-grid">
        {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  if (!agent) return <div className="page">{t('common.error')}</div>

  const initials = (agent.full_name || '?').slice(0, 2).toUpperCase()

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div className="pd-agent-avatar" style={{ width: 64, height: 64, fontSize: 22 }}>
          {initials}
        </div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>{agent.full_name}</h1>
          {agent.agency_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fho-text-muted)', fontSize: 13 }}>
              <Building2 size={13} /> {agent.agency_name}
            </div>
          )}
          {agent.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fho-text-muted)', fontSize: 13, marginTop: 2 }}>
              <Phone size={12} /> {agent.phone}
            </div>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        {t('account.myListings')} ({properties.length})
      </h2>

      {properties.length === 0 ? (
        <div className="placeholder-card">{t('listing.noListings')}</div>
      ) : (
        <div className="property-grid">
          {properties.map(p => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  )
}

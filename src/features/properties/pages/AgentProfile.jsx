import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, Building2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import PropertyCard from '../components/PropertyCard'
import SkeletonCard from '../../../shared/SkeletonCard'
import BackButton from '../../../shared/BackButton'

export default function AgentProfile() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [agent, setAgent] = useState(null)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setError(false)

    Promise.all([
      // Matches the anon SELECT grant on profiles exactly (see the
      // grant_anon_public_agent_profile_read migration) — this page is
      // reachable while logged out, and select('*') would reference columns
      // anon isn't granted (bio, role, ...), failing the whole query.
      //
      // maybeSingle, not single: an agent who was removed, or an id that never
      // existed, is a normal "not found" — single() rejects with PGRST116
      // there, which left `agent` null and rendered a bare word, "Error".
      supabase.from('profiles').select('id, full_name, phone, agency_name, avatar_url').eq('id', id).maybeSingle(),
      supabase.from('properties').select('*').eq('agent_id', id).eq('status', 'active').order('created_at', { ascending: false }),
    ]).then(([profileRes, propsRes]) => {
      if (!active) return
      // Both errors were previously discarded, so a network failure or an RLS
      // denial was indistinguishable from "this agent does not exist".
      if (profileRes.error) {
        console.error('AgentProfile: profile fetch failed:', profileRes.error.message)
        setError(true)
      } else {
        setAgent(profileRes.data)
      }
      if (propsRes.error) {
        // Non-fatal: the agent still renders, just with no listings. Logged so
        // an empty portfolio caused by a failed query is not read as "no homes".
        console.error('AgentProfile: listings fetch failed:', propsRes.error.message)
      } else {
        setProperties(propsRes.data || [])
      }
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

  // A failed fetch and a missing agent are different things and now read
  // differently. Both get a way out: this page is reachable from a shared link,
  // so there may be no in-app history to go back to.
  if (error) return (
    <div className="page">
      <BackButton to="/search" label={t('common.back')} />
      <div className="placeholder-card">{t('errors.generic')}</div>
    </div>
  )

  if (!agent) return (
    <div className="page">
      <BackButton to="/search" label={t('common.back')} />
      <div className="placeholder-card">
        <strong>{t('notFound.title')}</strong>
        <div style={{ marginTop: 4 }}>{t('notFound.subtitle')}</div>
      </div>
    </div>
  )

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

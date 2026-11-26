import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hasFacets, savedFromFilters, savedKey, savedLabel } from '@/src/features/saved-searches/lib/fromFilters.js'
import { countMatches } from '@/src/features/saved-searches/lib/matches.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// One click saves what is on the search page, with alerts on, as in the app
// (components/property/save-search-button.tsx).
export default function SaveSearchButton({ filters }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const saved = useMemo(() => savedFromFilters(filters), [filters])
  const queryKey = ['saved-search-keys', user?.id]
  const { data: keys } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('saved_searches').select('filters').limit(200)
      if (error) throw error
      return (data ?? []).map((row) => savedKey(row.filters))
    },
  })
  const already = keys?.includes(savedKey(saved)) ?? false

  if (!hasFacets(saved)) return null

  const save = async () => {
    if (saving) return
    if (already) return navigate('/saved-searches')
    if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
    setSaving(true)
    setFailed(false)
    // Start from what matches today, so only later listings count as new.
    const current = await countMatches(supabase, saved)
    const { error } = await supabase.from('saved_searches').insert({ user_id: user.id, name: savedLabel(saved, t), filters: saved, alerts_enabled: true, last_match_count: current ?? 0 })
    setSaving(false)
    if (error) return setFailed(true)
    qc.invalidateQueries({ queryKey })
  }

  const Icon = already ? BellRing : Bell
  return (
    <span className="save-search">
      <button type="button" className="link-btn" onClick={save} disabled={saving}>
        <Icon size={16} aria-hidden="true" />
        {saving ? t('common.loading') : already ? t('search.searchSaved') : t('search.saveSearch')}
      </button>
      {failed && <span className="muted small" role="alert">{t('errors.generic')}</span>}
    </span>
  )
}

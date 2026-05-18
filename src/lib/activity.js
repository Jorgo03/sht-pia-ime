import { supabase } from './supabase'

const recentViews = new Map()

export async function logActivity(propertyId, type, metadata = {}) {
  if (type === 'view') {
    const key = `${propertyId}`
    const last = recentViews.get(key)
    if (last && Date.now() - last < 60_000) return
    recentViews.set(key, Date.now())
  }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('property_activity').insert({
    property_id: propertyId,
    user_id: user?.id ?? null,
    type,
    metadata,
  })
}

export async function getFavorites(supabase, userId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('property_id, properties(*)')
    .eq('user_id', userId)

  if (error) throw error
  return (data ?? []).map((f) => f.properties).filter(Boolean)
}

export async function addFavorite(supabase, userId, propertyId) {
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, property_id: propertyId })

  if (error) throw error
}

export async function removeFavorite(supabase, userId, propertyId) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId)

  if (error) throw error
}

export async function isFavorite(supabase, userId, propertyId) {
  const { count, error } = await supabase
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('property_id', propertyId)

  if (error) return false
  return (count ?? 0) > 0
}

// New matches for a saved search, shared by the website and the phone app.
//
// There is no email or push sender yet, so "alerts" are shown in the app: the
// number of active listings that match a saved search now, compared with the
// number recorded the last time the person looked (`last_match_count`). It is a
// count difference, so it is worded as "more than last time", never as a list
// of specific new listings.
//
// The filter rules mirror the Search page (useProperties.applyFilters) for the
// keys a saved search can hold: city, zone (only with its city), listing_type,
// type, minPrice, maxPrice, beds.

import { validZone } from '../../properties/lib/searchFilters.js'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Apply a saved search's filters to a Supabase query on `properties`. */
export function applySavedFilters(query, filters) {
  const f = filters ?? {}
  if (f.city) query = query.ilike('city', `%${f.city}%`)
  const zone = validZone(f.city, f.zone)
  if (zone) query = query.eq('zone', zone)
  if (f.listing_type) query = query.eq('listing_type', f.listing_type)
  if (f.type && f.type !== 'all') query = query.eq('property_type', f.type)
  const minPrice = toNumber(f.minPrice)
  const maxPrice = toNumber(f.maxPrice)
  const beds = toNumber(f.beds)
  if (minPrice !== null) query = query.gte('price', minPrice)
  if (maxPrice !== null) query = query.lte('price', maxPrice)
  if (beds !== null) query = query.gte('beds', beds)
  return query
}

/** How many active listings match now, or null if the count failed. */
export async function countMatches(client, filters) {
  try {
    const query = applySavedFilters(
      client.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      filters,
    )
    const { count, error } = await query
    return error ? null : (count ?? 0)
  } catch {
    return null
  }
}

/** How many more matches than last time (never negative; 0 when unknown). */
export function newMatchCount(current, lastSeen) {
  if (current === null || current === undefined) return 0
  return Math.max(0, current - (lastSeen ?? 0))
}

/** Record that the person has now seen `current` matches. */
export async function markSeen(client, id, current) {
  if (current === null || current === undefined) return false
  try {
    const { error } = await client.from('saved_searches').update({ last_match_count: current }).eq('id', id)
    return !error
  } catch {
    return false
  }
}

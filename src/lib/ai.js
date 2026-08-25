// Client wrappers around the AI edge functions. Every call degrades
// gracefully: on any failure the caller gets null and the non-AI path keeps
// working.
import { supabase } from './supabase'
import { sanitizeSearchFilters } from './aiSchemas'

const parseCache = new Map() // query -> filters (session-lifetime)

export async function parseSearchQuery(query) {
  const key = query.trim().toLowerCase()
  if (parseCache.has(key)) return parseCache.get(key)
  try {
    const { data, error } = await supabase.functions.invoke('ai-parse-search', {
      body: { query },
    })
    if (error || !data?.filters) return null
    const filters = sanitizeSearchFilters(data.filters)
    if (filters) parseCache.set(key, filters)
    return filters
  } catch {
    return null
  }
}

export async function askListingAssistant(propertyId, messages, language = 'sq') {
  try {
    const { data, error } = await supabase.functions.invoke('ai-listing-assistant', {
      body: { property_id: propertyId, messages, language },
    })
    if (error || typeof data?.reply !== 'string') return null
    return data.reply
  } catch {
    return null
  }
}

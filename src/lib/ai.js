// Client wrappers around the AI edge functions. Every call degrades
// gracefully: on any failure the caller gets null (or a coded error for the
// generator, which shows a message) and the non-AI path keeps working.
import { supabase } from './supabase'
import { sanitizeSearchFilters, sanitizeGeneratedListing } from './aiSchemas'

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

// Throws { code: 'ai_unavailable' | 'rate_limited' | 'error' } on failure so
// the wizard can show the right message.
export async function generateListing(details, language = 'sq') {
  let res
  try {
    res = await supabase.functions.invoke('ai-generate-listing', {
      body: { details, language },
    })
  } catch {
    throw { code: 'error' }
  }
  if (res.error) {
    const status = res.error?.context?.status
    if (status === 429) throw { code: 'rate_limited' }
    throw { code: 'ai_unavailable' }
  }
  const clean = sanitizeGeneratedListing(res.data)
  if (!clean) throw { code: 'ai_unavailable' }
  return clean
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

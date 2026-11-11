// A person's public profile and the listings they publish (app/user/[id].tsx).
// Shared and pure, for `npm test`; the phone app imports it through
// publicProfile.d.ts.
//
// The person is always the id in the address, never the one looking. Their
// card comes from public_profile() on the server, which decides what may be
// shown (migration 20261111120000). Their listings are read from `properties`
// by publisher id, owner_id or agent_id, and only active ones: the table
// would also give the viewer their own drafts when they open their own
// profile, and a public profile must look the same to everyone.

export const PROFILE_PAGE_SIZE = 24

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True only for a real user id: anything else never reaches a query filter. */
export function isUserId(value) {
  return typeof value === 'string' && UUID.test(value)
}

const clean = (value) => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

// PostgREST's "no such function": the database does not have public_profile()
// yet (migration 20261111120000 not applied).
const MISSING_FUNCTION = 'PGRST202'

/** The server's card for a person, or null when it may not be shown. */
export async function fetchPublicProfile(client, userId) {
  if (!isUserId(userId)) return null
  const { data, error } = await client.rpc('public_profile', { p_user: userId })
  if (error?.code === MISSING_FUNCTION) return fetchProfileRow(client, userId)
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) ?? null
}

// Before the migration: what the agent page read until now, straight from
// `profiles`, whose policy shows agents to everyone and a client only to
// people it already allows. `role` is not readable signed out, and signed out
// only agents are visible, so a row without it is an agent. The count comes
// from the listings query instead. Remove once the migration is live.
async function fetchProfileRow(client, userId) {
  const columns = 'id, full_name, phone, agency_name, avatar_url'
  let res = await client.from('profiles').select(`${columns}, role`).eq('id', userId).maybeSingle()
  if (res.error) res = await client.from('profiles').select(columns).eq('id', userId).maybeSingle()
  if (res.error) throw res.error
  const row = res.data
  if (!row) return null
  return { ...row, kind: !('role' in row) || row.role === 'agent' ? 'agent' : 'client', listing_count: null }
}

/**
 * What the profile shows. A client never has an office, whatever arrives;
 * missing details are null; the count is never negative or fractional.
 */
export function publicProfileView(row) {
  if (!row) return null
  const kind = row.kind === 'agent' ? 'agent' : 'client'
  const count = Number(row.listing_count)
  return {
    id: row.id ?? null,
    kind,
    name: clean(row.full_name),
    avatarUrl: clean(row.avatar_url),
    phone: clean(row.phone),
    office: kind === 'agent' ? clean(row.agency_name) : null,
    listingCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
  }
}

/** Up to two initials for the avatar placeholder: "Evi Hoxha" → "EH". */
export function profileInitials(name) {
  const words = (clean(name) ?? '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words[words.length - 1]][0]]
  return letters.join('').toUpperCase()
}

/**
 * One page of a person's active listings, newest first, with the total.
 * `page` starts at 0. Throws on a failed request, so the screen can offer a
 * retry instead of claiming the person has no listings.
 */
export async function fetchPublisherListings(client, userId, page = 0) {
  if (!isUserId(userId)) return { rows: [], total: 0 }
  const from = page * PROFILE_PAGE_SIZE
  const { data, error, count } = await client
    .from('properties')
    .select('*', { count: 'exact' })
    .or(`owner_id.eq.${userId},agent_id.eq.${userId}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(from, from + PROFILE_PAGE_SIZE - 1)
  if (error) throw error
  const rows = data ?? []
  return { rows, total: typeof count === 'number' ? count : from + rows.length }
}

/**
 * The person a conversation is with, seen by `viewerId`: the participant who
 * is not the viewer. Null when the viewer is not in it, or it is with
 * themselves, so the header never opens the viewer's own profile.
 */
export function otherParticipant(conversation, viewerId) {
  if (!conversation || !viewerId) return null
  const { client_id: client, agent_id: agent } = conversation
  if (client === viewerId && agent && agent !== viewerId) return agent
  if (agent === viewerId && client && client !== viewerId) return client
  return null
}

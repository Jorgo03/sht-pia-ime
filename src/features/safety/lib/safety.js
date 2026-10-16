// Report and block, shared by the website and the phone app so both apps file
// the same rows and read the same errors. Each app passes its own Supabase
// client (one client per app).
//
// The rules live in the database (migration 20261016181934_report_and_block):
// a report can only be filed, never read back, and a second open report of the
// same thing by the same person fails with 23505; a block is visible only to
// the person who made it, and a blocked person's messages are refused (42501).

export const REPORT_REASONS = ['spam', 'scam', 'wrong_info', 'unavailable', 'offensive', 'other']
export const MAX_REPORT_DETAILS = 1000

/**
 * Report a listing or a user. Resolves to 'sent', 'already' (this person has
 * an open report of the same thing) or 'failed'. Never throws.
 */
export async function fileReport(client, { propertyId, userId, reason, details }) {
  if (!REPORT_REASONS.includes(reason)) return 'failed'
  if (!propertyId && !userId) return 'failed'
  const row = { reason }
  if (propertyId) row.property_id = propertyId
  if (userId) row.reported_user_id = userId
  const text = (details ?? '').trim().slice(0, MAX_REPORT_DETAILS)
  if (text) row.details = text
  try {
    // No .select(): the reporter is not allowed to read reports back.
    const { error } = await client.from('content_reports').insert(row)
    if (!error) return 'sent'
    return error.code === '23505' ? 'already' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Block someone. Blocking someone already blocked counts as done. */
export async function blockUser(client, blockedId) {
  try {
    const { error } = await client.from('user_blocks').insert({ blocked_id: blockedId })
    return !error || error.code === '23505'
  } catch {
    return false
  }
}

/** Unblock someone. The database only lets you remove your own blocks. */
export async function unblockUser(client, blockedId) {
  try {
    const { error } = await client.from('user_blocks').delete().eq('blocked_id', blockedId)
    return !error
  } catch {
    return false
  }
}

/** Everyone the signed-in user has blocked, as a Set of ids (empty on error). */
export async function loadBlockedIds(client) {
  try {
    const { data, error } = await client.from('user_blocks').select('blocked_id')
    if (error) return new Set()
    return new Set((data ?? []).map((row) => row.blocked_id))
  } catch {
    return new Set()
  }
}

/** True when a message insert was refused because the other person blocked you. */
export function isBlockedSendError(error) {
  return error?.code === '42501'
}

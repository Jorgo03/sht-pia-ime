// Moderation queue (docs/LAUNCH_TASKS.md F3), kept free of React so it can be
// tested and later reused by the phone app. Each app passes its own client.
//
// The database decides who is a moderator (public.moderators, managed by the
// owner with SQL) and enforces it on every path: reports are readable only by
// moderators, and the two actions are SECURITY DEFINER functions that check
// is_moderator() themselves (migrations 20261021052850_moderation and
// 20261021053224_moderation_read_access). Nothing here is a security boundary.

export const PAGE_SIZE = 24
export const QUEUES = ['open', 'closed']

const REPORT_COLUMNS = 'id, reason, details, status, created_at, reviewed_at, resolution_note, property_id, reported_user_id'

/** True only when the database says the signed-in user is a moderator. */
export async function isModerator(client) {
  try {
    const { data, error } = await client.rpc('is_moderator')
    return !error && data === true
  } catch {
    return false
  }
}

/**
 * One page of reports, newest first, each with the listing and the account it
 * is about (null when that row no longer exists). `queue` is 'open' or
 * 'closed' (actioned or dismissed). Resolves to { rows, more } or null on error.
 */
export async function loadReports(client, { queue = 'open', offset = 0 } = {}) {
  try {
    let query = client.from('content_reports').select(REPORT_COLUMNS)
    query = queue === 'closed'
      ? query.in('status', ['actioned', 'dismissed']).order('reviewed_at', { ascending: false })
      : query.eq('status', 'open').order('created_at', { ascending: false })
    // One extra row tells us whether there is another page.
    const { data, error } = await query.range(offset, offset + PAGE_SIZE)
    if (error) return null
    const page = (data ?? []).slice(0, PAGE_SIZE)
    const propertyIds = unique(page.map((r) => r.property_id))
    const userIds = unique(page.map((r) => r.reported_user_id))
    const [listings, people] = await Promise.all([
      propertyIds.length ? client.from('properties').select('id, title, status, moderation_hold, owner_id').in('id', propertyIds) : { data: [] },
      userIds.length ? client.from('profiles').select('id, full_name, role').in('id', userIds) : { data: [] },
    ])
    if (listings.error || people.error) return null
    const byId = (rows) => new Map((rows ?? []).map((row) => [row.id, row]))
    const listingById = byId(listings.data)
    const personById = byId(people.data)
    return {
      rows: page.map((r) => ({
        ...r,
        listing: r.property_id ? listingById.get(r.property_id) ?? null : null,
        person: r.reported_user_id ? personById.get(r.reported_user_id) ?? null : null,
      })),
      more: (data ?? []).length > PAGE_SIZE,
    }
  } catch {
    return null
  }
}

/** Hide a listing for review (hide = true) or put it back online. */
export async function setListingHidden(client, propertyId, hide) {
  try {
    const { error } = await client.rpc('moderate_listing', { p_property: propertyId, p_hide: hide === true })
    return !error
  } catch {
    return false
  }
}

/** Close a report as 'actioned' or 'dismissed', with an optional note. */
export async function resolveReport(client, reportId, status, note) {
  if (status !== 'actioned' && status !== 'dismissed') return false
  const text = (note ?? '').trim().slice(0, 1000)
  try {
    const { error } = await client.rpc('resolve_report', { p_report: reportId, p_status: status, p_note: text || null })
    return !error
  } catch {
    return false
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

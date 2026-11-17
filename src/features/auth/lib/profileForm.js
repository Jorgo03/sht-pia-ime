// "Edit profile" rules, shared by the website and the phone app
// (docs/LAUNCH_TASKS.md L12).
//
// The patch carries only the fields that changed. That matters beyond saving a
// request: `profiles` UPDATE is granted per column, and `phone` becomes
// writable only with supabase/pending/profile_phone_update.sql. Until that is
// applied, a name or agency change still saves, and only a phone change is
// refused (and shown as a failed save, never as success).

export const PROFILE_LIMITS = { full_name: 80, agency_name: 80, phone: 32 }

// Digits, spaces, brackets and dashes, optionally after a leading +. Mirrors
// the profiles_phone_format check in the pending migration.
const PHONE_RE = /^\+?[0-9 ()-]{6,32}$/

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

/** True for an empty phone (it clears the number) or a plausible one. */
export function isValidPhone(value) {
  const s = clean(value)
  if (!s) return true
  return PHONE_RE.test(s) && s.replace(/\D/g, '').length >= 6
}

/**
 * Turn the form into an update.
 * Returns { patch, error }: error is 'nameRequired' | 'tooLong' | 'phoneInvalid' | null.
 * Agency is an agent field; a client's form never writes it.
 */
export function profilePatch(current, form, { isAgent = false } = {}) {
  const before = current ?? {}
  const next = { full_name: clean(form?.full_name), phone: clean(form?.phone) || null }
  if (isAgent) next.agency_name = clean(form?.agency_name) || null

  if (!next.full_name) return { patch: {}, error: 'nameRequired' }
  for (const [key, value] of Object.entries(next)) {
    if (value && value.length > PROFILE_LIMITS[key]) return { patch: {}, error: 'tooLong' }
  }
  if (!isValidPhone(next.phone)) return { patch: {}, error: 'phoneInvalid' }

  const patch = {}
  for (const [key, value] of Object.entries(next)) {
    if ((before[key] ?? null) !== value) patch[key] = value
  }
  return { patch, error: null }
}

/** Save a patch for the signed-in user: 'saved' | 'unchanged' | 'failed'. */
export async function saveProfile(client, userId, patch) {
  if (!patch || Object.keys(patch).length === 0) return 'unchanged'
  try {
    const { error } = await client.from('profiles').update(patch).eq('id', userId)
    return error ? 'failed' : 'saved'
  } catch {
    return 'failed'
  }
}

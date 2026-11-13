// What a single-listing fetch means, shared by both apps (the phone app
// imports it through propertyResult.d.ts). Pure, for `npm test`.
//
// PGRST116 ("0 rows") is the only answer that means the listing is gone or
// not visible to this person. Anything else (offline, timeout, 5xx) is
// thrown, so the screen shows an error with a retry instead of telling
// someone a live listing was removed (AUDIT-006).
export function propertyOrNotFound({ data, error }) {
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data ?? null
}

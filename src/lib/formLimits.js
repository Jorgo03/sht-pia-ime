// Limits for what people type into forms, shared by the apps and the database.
// The forms stop at these values (maxLength, step checks); the database
// refuses anything past them too (supabase/migrations/20261104210000_server_form_checks.sql),
// so a request sent around the app is checked the same way.
// tests/formLimits.test.mjs fails if the two drift apart.

export const FORM_LIMITS = {
  listingTitle: 200,
  listingDescription: 10000,
  listingAddress: 300,
  city: 80,
  message: 4000,
  viewingNotes: 1000,
  wantedNotes: 2000,
  savedSearchName: 120,
  email: 254,
  maxPrice: 999_999_999,
  maxBedrooms: 50,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** True for an empty email (the field is optional) or a plausible one. */
export function isValidEmail(value) {
  const s = String(value ?? '').trim()
  if (!s) return true
  return s.length <= FORM_LIMITS.email && EMAIL_RE.test(s)
}

/** True for an empty value or a whole number from min to max. */
export function inIntRange(value, min, max) {
  const s = String(value ?? '').trim()
  if (!s) return true
  const n = Number(s)
  return Number.isInteger(n) && n >= min && n <= max
}

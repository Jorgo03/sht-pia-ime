// An agent's leads and buyer-request matching, shared by the phone app and
// (later) the website. Pure, for `npm test`. docs/BSP_CRM_ANALYSIS.md, phase 1.

import { isValidPhone } from '../../auth/lib/profileForm.js'
import { UNITS_PER_EUR } from '../../properties/lib/priceRange.js'

/** The pipeline, in order. The database allows exactly these (leads_status_check). */
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost']

export const LEAD_LIMITS = { name: 120, phone: 32, email: 254, notes: 2000 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const clean = (value) => String(value ?? '').replace(/[ \t]+/g, ' ').trim()

/**
 * The form as a row to save.
 * Returns { row, error }: error is 'nameRequired' | 'tooLong' | 'phoneInvalid'
 * | 'emailInvalid' | null. Empty optional fields are saved as null.
 */
export function leadRow(form) {
  const row = {
    name: clean(form?.name),
    phone: clean(form?.phone) || null,
    email: clean(form?.email).toLowerCase() || null,
    notes: String(form?.notes ?? '').trim() || null,
    status: LEAD_STATUSES.includes(form?.status) ? form.status : 'new',
  }
  if (!row.name) return { row: null, error: 'nameRequired' }
  for (const [key, max] of Object.entries(LEAD_LIMITS)) {
    if (row[key] && row[key].length > max) return { row: null, error: 'tooLong' }
  }
  if (!isValidPhone(row.phone)) return { row: null, error: 'phoneInvalid' }
  if (row.email && !EMAIL_RE.test(row.email)) return { row: null, error: 'emailInvalid' }
  return { row, error: null }
}

/** Lower case, accents off: "Tiranë" and "tirane" are the same word. */
export const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// PostgREST `or=(...)` syntax and LIKE wildcards: never let a search typed by
// the agent change the shape of the filter.
const SEARCH_UNSAFE = /[,()*%_\\:."']/g

/**
 * The PostgREST `or` filter for a lead search, or null for an empty one.
 * Name, email and notes contain the words. A phone matches its digits in
 * order whatever the spacing, and a local number ("069 123…") matches the
 * same number saved internationally ("+355 69 123…").
 */
export function leadSearchFilter(query) {
  const text = String(query ?? '').replace(SEARCH_UNSAFE, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!text) return null
  const parts = [`name.ilike.*${text}*`, `email.ilike.*${text}*`, `notes.ilike.*${text}*`]
  const digits = text.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length >= 3) parts.push(`phone.ilike.*${digits.split('').join('*')}*`)
  return parts.join(',')
}

/** A listing's price in euros, with the price filter's reference rates. */
export function priceInEur(listing) {
  const rate = UNITS_PER_EUR[listing?.currency] ?? 1
  if (listing?.price == null || listing.price === '') return null
  const n = Number(listing.price)
  return Number.isFinite(n) ? n / rate : null
}

// Albanian place names change ending with the article: Tiranë/Tirana,
// Durrës/Durrësi, Vlorë/Vlora. Compare without a final vowel.
const placeStem = (value) => fold(value).replace(/[aeiëu]$/, '')

/**
 * Does an active listing fit a buyer request (`wanted_homes`)?
 * City: either name contains the other, accents ignored ("Tirana" fits
 * "Tiranë"). Sale or rent must be the same. The budget is in euros. Bedrooms
 * are a minimum; a listing that does not say how many does not fit a minimum.
 */
export function matchesWanted(wanted, listing) {
  if (!wanted || !listing || listing.status !== 'active') return false
  const wantCity = placeStem(wanted.city)
  const city = placeStem(listing.city)
  if (wantCity && !(city && (city.includes(wantCity) || wantCity.includes(city)))) return false
  if (wanted.listing_type && listing.listing_type !== wanted.listing_type) return false
  const max = Number(wanted.max_price)
  if (wanted.max_price != null && Number.isFinite(max) && max > 0) {
    const eur = priceInEur(listing)
    if (eur == null || eur > max) return false
  }
  const beds = Number(wanted.min_bedrooms)
  if (wanted.min_bedrooms != null && Number.isFinite(beds) && beds > 0) {
    if (!(Number(listing.beds) >= beds)) return false
  }
  return true
}

/** The listings that fit a buyer request, cheapest first. */
export function wantedMatches(wanted, listings) {
  return (listings ?? [])
    .filter((l) => matchesWanted(wanted, l))
    .sort((a, b) => (priceInEur(a) ?? Infinity) - (priceInEur(b) ?? Infinity))
}

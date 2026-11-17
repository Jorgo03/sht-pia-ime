// Conversions between a saved `properties` row and the listing wizard's form,
// shared by the web wizard (NewListing.jsx) and the Expo wizard
// (app/listing/new.tsx) so creating and editing a listing write exactly the
// same columns in both apps.
//
// The form keeps numbers as strings (text inputs); the row keeps them as
// numbers or null. Ownership, status and media are deliberately not part of
// either conversion: who owns a listing never changes on save, status has its
// own actions (pause, mark sold), and photos/video are uploaded separately.

import { validZone } from '../../properties/lib/searchFilters.js'

const toText = (value) => (value === null || value === undefined ? '' : String(value))

/** A saved listing, as the wizard's form state. */
export function propertyToForm(row) {
  const titleMap = row.title_i18n && typeof row.title_i18n === 'object' ? row.title_i18n : {}
  const descriptionMap =
    row.description_i18n && typeof row.description_i18n === 'object' ? row.description_i18n : {}
  return {
    listing_type: row.listing_type ?? 'sale',
    property_type: row.property_type ?? 'apartment',
    // Rows from before per-language columns only have the plain fields.
    title_i18n: { ...titleMap, sq: titleMap.sq ?? row.title ?? '' },
    description_i18n: { ...descriptionMap, sq: descriptionMap.sq ?? row.description ?? '' },
    translation_meta:
      row.translation_meta && typeof row.translation_meta === 'object' ? row.translation_meta : {},
    city: row.city ?? '',
    zone: row.zone ?? '',
    address: row.address ?? '',
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    price: toText(row.price),
    currency: row.currency ?? 'EUR',
    sqft: toText(row.sqft),
    beds: toText(row.beds),
    baths: toText(row.baths),
    floor: toText(row.floor),
    total_floors: toText(row.total_floors),
    year_built: toText(row.year_built),
    features: Array.isArray(row.features) ? row.features : [],
    contact_phone: row.contact_phone ?? '',
    whatsapp_enabled: row.whatsapp_enabled ?? true,
    contact_email: row.contact_email ?? '',
  }
}

/** A whole number for an integer column, or null when blank or unreadable. */
const optionalInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? n : null
}

/**
 * The columns a save writes, from the form plus the translated maps that
 * `translateAll()` returned (form state has not caught up with them yet when
 * the save runs). Used for both insert and update.
 */
export function formToColumns(form, translated) {
  return {
    title: translated.title_i18n.sq || '',
    title_i18n: translated.title_i18n,
    description: translated.description_i18n.sq || '',
    description_i18n: translated.description_i18n,
    // The wizard authors in Albanian and translates outward from it.
    source_language: 'sq',
    // Which languages are machine output and which an agent corrected by hand,
    // so a later save does not regenerate over their work.
    translation_meta: translated.translation_meta,
    listing_type: form.listing_type,
    property_type: form.property_type,
    city: form.city || null,
    // Only a zone of the chosen city is kept (a city change clears it in the UI).
    zone: validZone(form.city, form.zone),
    address: form.address,
    latitude: form.latitude,
    longitude: form.longitude,
    price: Number(form.price) || 0,
    currency: form.currency,
    // sqft, beds, floor, total_floors and year_built are integer columns,
    // which refuse 85.5 outright (22P02) after the photos have uploaded;
    // baths is numeric(3,1) and keeps its half.
    sqft: Math.round(Number(form.sqft)) || 0,
    beds: Math.round(Number(form.beds)) || 0,
    baths: Number(form.baths) || 0,
    floor: optionalInteger(form.floor),
    total_floors: optionalInteger(form.total_floors),
    year_built: optionalInteger(form.year_built),
    features: form.features,
    contact_phone: form.contact_phone || null,
    whatsapp_enabled: form.whatsapp_enabled,
    contact_email: form.contact_email || null,
  }
}

/** The status that closes a listing: a sale is sold, a rental is rented. */
export function closedStatusFor(listingType) {
  return listingType === 'sale' ? 'sold' : 'rented'
}

const PUBLIC_MARKER = '/storage/v1/object/public/'

/**
 * Storage paths of media an edit removed, so they can be deleted after the
 * save succeeds (docs/LAUNCH_TASKS.md L07). Only files in `bucket` under the
 * editor's own folder (`<userId>/…`) qualify: the storage policies allow
 * nothing else, and another agent's photo on a shared listing must survive.
 */
export function removedMediaPaths({ before = [], after = [], userId, bucket = 'property-images' }) {
  if (!userId) return []
  const kept = new Set(after.filter(Boolean))
  const paths = []
  for (const url of before) {
    if (!url || kept.has(url)) continue
    const at = url.indexOf(`${PUBLIC_MARKER}${bucket}/`)
    if (at === -1) continue
    const path = decodeURIComponent(url.slice(at + PUBLIC_MARKER.length + bucket.length + 1).split('?')[0])
    if (path.startsWith(`${userId}/`) && !path.includes('..') && !paths.includes(path)) paths.push(path)
  }
  return paths
}

/**
 * What the price box keeps as the person types: digits and at most one
 * decimal point, read the way people write money here, so a price is never
 * silently changed by an order of magnitude:
 * - several separators ("1.200.000", "1,200,000") are thousands: dropped;
 * - one separator followed by exactly 3 digits ("1.500", "1,500") is
 *   thousands too;
 * - one separator followed by 1-2 digits ("1500,5", "99.99") is the decimal
 *   point, written as "."; a trailing one ("1500,") is kept while typing;
 * - both kinds at once ("250.000,00", "1,200.50", as pasted from another
 *   portal or a spreadsheet): the last is the decimal point when at most 2
 *   digits follow it, and the others group thousands. Dropping them all
 *   made 250.000,00 into 25,000,000.
 * Spaces and anything that is not a digit are dropped. Never converts
 * between currencies.
 */
export function normalizeAmount(text) {
  const kept = String(text ?? '').replace(/[^0-9.,]/g, '')
  const seps = kept.match(/[.,]/g) ?? []
  if (seps.length === 0) return kept
  const digitsOnly = kept.replace(/[.,]/g, '')
  const last = Math.max(kept.lastIndexOf('.'), kept.lastIndexOf(','))
  const whole = kept.slice(0, last).replace(/[.,]/g, '')
  const fraction = kept.slice(last + 1)
  if (new Set(seps).size > 1) return fraction.length <= 2 ? `${whole}.${fraction}` : digitsOnly
  if (seps.length > 1) return digitsOnly
  if (fraction.length === 3) return digitsOnly
  return `${whole}.${fraction.slice(0, 2)}`
}

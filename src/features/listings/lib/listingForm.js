// Conversions between a saved `properties` row and the listing wizard's form,
// shared by the web wizard (NewListing.jsx) and the Expo wizard
// (app/listing/new.tsx) so creating and editing a listing write exactly the
// same columns in both apps.
//
// The form keeps numbers as strings (text inputs); the row keeps them as
// numbers or null. Ownership, status and media are deliberately not part of
// either conversion: who owns a listing never changes on save, status has its
// own actions (pause, mark sold), and photos/video are uploaded separately.

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

const optionalNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value))

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
    address: form.address,
    latitude: form.latitude,
    longitude: form.longitude,
    price: Number(form.price) || 0,
    currency: form.currency,
    sqft: Number(form.sqft) || 0,
    beds: Number(form.beds) || 0,
    baths: Number(form.baths) || 0,
    floor: optionalNumber(form.floor),
    total_floors: optionalNumber(form.total_floors),
    year_built: optionalNumber(form.year_built),
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

import { findCity } from '@/src/features/properties/lib/places.js'
import { getLocalizedText, formatPrice } from '@/src/lib/format.js'

export { formatPrice, getLocalizedText }
export { listingBadgeKey, priceSuffixKey, telUrl, whatsappUrl } from '@/src/lib/format.js'

/** A city's name in the visitor's language ("Durrës" → "Durazzo" in Italian). */
export function cityName(city, lang) {
  const known = findCity(city)
  return known?.names?.[lang] || known?.city || city || ''
}

export const titleOf = (p, lang) => getLocalizedText(p.title_i18n, lang) || p.title || ''

/** "€250,000" with no decimals, in the visitor's number style. */
export const priceOf = (p, lang) => formatPrice(p.price, lang, p.currency)

/** The property types search offers, matching the app's filter values. */
export const PROPERTY_TYPES = ['apartment', 'villa', 'office', 'commercial', 'land']

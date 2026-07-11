const GRADIENTS = [
  'linear-gradient(135deg, #a08868 0%, #7a5d3f 50%, #4a3520 100%)',
  'linear-gradient(135deg, #9eb09a, #5f7158)',
  'linear-gradient(135deg, #c2a895, #8a6f5a)',
  'linear-gradient(135deg, #8b9d83, #5d6b56)',
  'linear-gradient(135deg, #b8a89d, #8a7868)',
  'linear-gradient(135deg, #6b7d8a, #485966)',
  'linear-gradient(135deg, #a99580, #756352)',
  'linear-gradient(135deg, #8a9b8e, #5c6b5e)',
]

export function gradientFor(id) {
  if (!id) return GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

export function imageFor(property) {
  if (property?.image_urls?.[0]) return null
  return gradientFor(property?.id)
}

export function formatPrice(n, lang = 'sq', currency = 'EUR') {
  const num = Number(n) || 0
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

// i18n key for a listing-type badge / price suffix — the only place that
// knows all three listing types, so daily_rent can't fall through to "For
// Sale" again. Suffix is null for sales (no suffix).
export function listingBadgeKey(listingType) {
  if (listingType === 'rent') return 'property.forRent'
  if (listingType === 'daily_rent') return 'property.forDailyRent'
  return 'property.forSale'
}

export function priceSuffixKey(listingType) {
  if (listingType === 'rent') return 'property.perMonth'
  if (listingType === 'daily_rent') return 'property.perDay'
  return null
}

export function getLocalizedText(i18nObj, lang, fallback = 'en') {
  if (!i18nObj || typeof i18nObj !== 'object') return i18nObj ?? ''
  return i18nObj[lang] ?? i18nObj[fallback] ?? i18nObj.sq ?? Object.values(i18nObj)[0] ?? ''
}

export function formatDate(dateStr, lang = 'sq') {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr))
}

export function formatRelativeTime(iso, locale = 'sq') {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diff < 60) return rtf.format(-Math.floor(diff), 'second')
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute')
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour')
  if (diff < 604800) return rtf.format(-Math.floor(diff / 86400), 'day')
  return new Date(iso).toLocaleDateString(locale)
}

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function whatsappUrl(phone, message) {
  const clean = phone?.replace(/[^0-9]/g, '') || ''
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

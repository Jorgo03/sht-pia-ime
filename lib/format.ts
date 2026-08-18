const GRADIENTS = [
  'linear-gradient(135deg, #a08868 0%, #7a5d3f 50%, #4a3520 100%)',
  'linear-gradient(135deg, #9eb09a, #5f7158)',
  'linear-gradient(135deg, #c2a895, #8a6f5a)',
  'linear-gradient(135deg, #8b9d83, #5d6b56)',
  'linear-gradient(135deg, #b8a89d, #8a7868)',
  'linear-gradient(135deg, #6b7d8a, #485966)',
  'linear-gradient(135deg, #a99580, #756352)',
  'linear-gradient(135deg, #8a9b8e, #5c6b5e)',
];

const FALLBACK_COLORS: [string, string][] = [
  ['#a08868', '#4a3520'],
  ['#9eb09a', '#5f7158'],
  ['#c2a895', '#8a6f5a'],
  ['#8b9d83', '#5d6b56'],
  ['#b8a89d', '#8a7868'],
  ['#6b7d8a', '#485966'],
  ['#a99580', '#756352'],
  ['#8a9b8e', '#5c6b5e'],
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function fallbackColorsFor(id: string | undefined): [string, string] {
  if (!id) return FALLBACK_COLORS[0];
  return FALLBACK_COLORS[hashId(id) % FALLBACK_COLORS.length];
}

export function formatPrice(n: number | string, lang: string = 'sq', currency: string | null = 'EUR'): string {
  const num = Number(n) || 0;
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Mirrors src/lib/format.js exactly — the only place that knows all three
// listing types, so daily_rent can't fall through to "For Sale"/no-suffix
// the way a bare `listing_type === 'rent'` check does.
export function listingBadgeKey(listingType: string | null | undefined): string {
  if (listingType === 'rent') return 'property.forRent';
  if (listingType === 'daily_rent') return 'property.forDailyRent';
  return 'property.forSale';
}

export function priceSuffixKey(listingType: string | null | undefined): string | null {
  if (listingType === 'rent') return 'property.perMonth';
  if (listingType === 'daily_rent') return 'property.perDay';
  return null;
}

export function getLocalizedText(
  i18nObj: Record<string, string> | null | undefined,
  lang: string,
  fallback: string = 'en',
): string {
  if (!i18nObj || typeof i18nObj !== 'object') return String(i18nObj ?? '');
  return (
    i18nObj[lang] ??
    i18nObj[fallback] ??
    i18nObj.sq ??
    Object.values(i18nObj)[0] ??
    ''
  );
}

// Fixed DD/MM/YYYY in every language (owner decision, 2026-08-18) rather than
// each locale's own month-name style — `lang` is kept only so existing call
// sites don't need touching; it no longer drives the output.
export function formatDate(dateStr: string | null | undefined, lang: string = 'sq'): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function formatRelativeTime(iso: string | null | undefined, locale: string = 'sq'): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.floor(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 604800) return rtf.format(-Math.floor(diff / 86400), 'day');
  // Beyond a week, fall back to the same DD/MM/YYYY every other displayed
  // date uses, rather than a second, separate date-formatting rule.
  return formatDate(iso);
}

export function whatsappUrl(phone: string | undefined, message: string): string {
  let clean = phone?.replace(/[^0-9]/g, '') || '';
  // wa.me requires full international format with no leading 0. Agents
  // enter local Albanian numbers (e.g. "069 602 0791"), so assume Albania's
  // country code (355) whenever one isn't already present — without this,
  // WhatsApp's Universal Link handler silently rejects the malformed number
  // and Linking.openURL fails with "Unable to open URL".
  if (clean.startsWith('0')) {
    clean = `355${clean.slice(1)}`;
  } else if (!clean.startsWith('355')) {
    clean = `355${clean}`;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

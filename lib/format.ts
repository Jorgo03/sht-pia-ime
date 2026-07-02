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

export function formatPrice(n: number | string, lang: string = 'sq'): string {
  const num = Number(n) || 0;
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
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

export function formatDate(dateStr: string | null | undefined, lang: string = 'sq'): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr));
}

export function formatRelativeTime(iso: string | null | undefined, locale: string = 'sq'): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.floor(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 604800) return rtf.format(-Math.floor(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString(locale);
}

export function whatsappUrl(phone: string | undefined, message: string): string {
  const clean = phone?.replace(/[^0-9]/g, '') || '';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

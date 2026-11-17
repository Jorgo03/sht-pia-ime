// Pure helpers for the website's language links (hreflang) and canonical
// address. The language is not part of the path: one page per address, in
// Albanian by default, and `?lang=<code>` opens it in another language
// (i18n/index.ts reads it). So each language has its own crawlable address.
import { DEFAULT_LANGUAGE, LANGUAGES } from '../i18n/languages.js';

// Signed-in pages: kept out of search results (robots.txt) and given no
// language links. Prefixes; '/listing/' covers create, edit and analytics.
export const PRIVATE_ROUTES = ['/profile', '/messages', '/favorites', '/my-listings', '/listing/', '/viewings', '/saved-searches', '/agent-dashboard', '/auth/', '/moderation', '/notifications', '/leads', '/performance', '/blocked-users'];

export const isPrivatePath = (pathname) => PRIVATE_ROUTES.some((r) => String(pathname || '').startsWith(r));

/** Address of `pathname` in `lang` on `site` (no trailing slash on site). */
export function localizedUrl(site, pathname, lang) {
  const path = !pathname || pathname === '/' ? '/' : `/${String(pathname).replace(/^\/+/, '')}`;
  const base = `${site}${path === '/' ? '' : path}` || '/';
  return lang && lang !== DEFAULT_LANGUAGE ? `${base}?lang=${encodeURIComponent(lang)}` : base;
}

/**
 * Canonical address plus one alternate per language and an x-default (the
 * Albanian page), for the page at `pathname` shown in `lang`.
 */
export function languageLinks(site, pathname, lang) {
  const current = LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  return {
    canonical: localizedUrl(site, pathname, current),
    alternates: [
      ...LANGUAGES.map((l) => ({ hreflang: l, href: localizedUrl(site, pathname, l) })),
      { hreflang: 'x-default', href: localizedUrl(site, pathname, DEFAULT_LANGUAGE) },
    ],
  };
}

/** The `lang` query value of a search string, when it is a shipped language. */
export function languageFromSearch(search) {
  try {
    const value = new URLSearchParams(String(search || '')).get('lang');
    return value && LANGUAGES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

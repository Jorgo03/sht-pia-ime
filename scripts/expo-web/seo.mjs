// Pure helpers for scripts/expo-web-postbuild.mjs (the website built from the
// Expo app). Kept free of I/O so tests/expoWebSeo.test.mjs can check them.

import { PRIVATE_ROUTES, languageLinks } from '../../lib/web-seo.js';

export { PRIVATE_ROUTES };

export const SITE_NAME = 'Shtëpia.ime';
export const PUBLIC_ROUTES = ['/', '/explore', '/wanted', '/guide', '/agents', '/privacy', '/terms', '/cookies', '/pricing'];

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Head values for one listing's page, in Albanian (the pre-rendered
 * language), matching what the app's PageHead shows: "<title> - <city>".
 * Falls back to the site description when the listing has none.
 */
export function listingHead(row, { site, siteDescription }) {
  const title = clean(row.title_i18n?.sq || row.title);
  const city = clean(row.city);
  const full = `${city ? `${title} - ${city}` : title || SITE_NAME} | ${SITE_NAME}`;
  const text = clean(row.description_i18n?.sq || row.description).slice(0, 160) || siteDescription;
  const image = Array.isArray(row.image_urls) ? row.image_urls.find((u) => typeof u === 'string' && u.startsWith('https://')) : null;
  return { title: full, description: text, url: `${site}/property/${row.id}`, site, path: `/property/${row.id}`, image: image || null };
}

/**
 * Puts a page's own title, description and link-preview tags into the
 * exported template (property/[id].html), replacing the generic ones the
 * static render wrote, and adds a canonical URL.
 */
export function applyHead(html, head) {
  let out = html
    .replace(/<title data-rh="true">[^<]*<\/title>/, () => `<title data-rh="true">${escapeText(head.title)}</title>`)
    .replace(/<meta data-rh="true" name="description" content="[^"]*"\/>/, () => `<meta data-rh="true" name="description" content="${escapeAttr(head.description)}"/>`)
    .replace(/<meta data-rh="true" property="og:title" content="[^"]*"\/>/, () => `<meta data-rh="true" property="og:title" content="${escapeAttr(head.title)}"/>`)
    .replace(/<meta data-rh="true" property="og:description" content="[^"]*"\/>/, () => `<meta data-rh="true" property="og:description" content="${escapeAttr(head.description)}"/>`)
    // The template's own links point at "/property/[id]"; drop them.
    .replace(/<link data-rh="true" rel="(canonical|alternate)"[^>]*\/>/g, '')
    .replace(/<meta data-rh="true" property="og:url" content="[^"]*"\/>/g, '');
  // The static render writes no head tags of its own today (expo-router/head
  // only fills them in the browser), so add them when they are missing:
  // search engines and link previews read this HTML, not the running app.
  const missing = !/<title[\s>]/.test(out)
    ? [
        `<title>${escapeText(head.title)}</title>`,
        `<meta name="description" content="${escapeAttr(head.description)}"/>`,
        `<meta property="og:title" content="${escapeAttr(head.title)}"/>`,
        `<meta property="og:description" content="${escapeAttr(head.description)}"/>`,
      ]
    : [];
  const extra = [
    ...missing,
    `<link rel="canonical" href="${escapeAttr(head.url)}"/>`,
    `<meta property="og:url" content="${escapeAttr(head.url)}"/>`,
    head.image ? `<meta property="og:image" content="${escapeAttr(head.image)}"/>` : '',
    ...(head.site && head.path
      ? languageLinks(head.site, head.path, 'sq').alternates.map(
          (a) => `<link rel="alternate" hreflang="${escapeAttr(a.hreflang)}" href="${escapeAttr(a.href)}"/>`,
        )
      : []),
  ].join('');
  // A function, not a string: "$&" or "$'" in a listing's text must stay literal.
  out = out.replace('</head>', () => `${extra}</head>`);
  return out;
}

/**
 * The public pages' pre-rendered files and the Albanian locale key of each
 * page's title (as components/web/page-head.tsx's ROUTE_TITLES); null is the
 * site title (Home).
 */
export const STATIC_PAGES = [
  { path: '/', file: 'index.html', key: null },
  { path: '/explore', file: 'explore.html', key: 'search.title' },
  { path: '/wanted', file: 'wanted.html', key: 'wanted.homeTitle' },
  { path: '/guide', file: 'guide.html', key: 'legal.buyingGuide' },
  { path: '/agents', file: 'agents/index.html', key: 'site.nav.agencies' },
  { path: '/privacy', file: 'privacy.html', key: 'legal.privacyPolicy' },
  { path: '/terms', file: 'terms.html', key: 'legal.termsOfService' },
  { path: '/cookies', file: 'cookies.html', key: 'legal.cookiePolicy' },
  { path: '/pricing', file: 'pricing.html', key: 'pricing.title' },
];

const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** Head values for a static public page, in Albanian. */
export function staticPageHead(page, sq, site) {
  const label = page.key ? lookup(sq, page.key) : null;
  return {
    title: label ? `${label} | ${SITE_NAME}` : lookup(sq, 'seo.siteTitle'),
    description: lookup(sq, 'seo.siteDescription'),
    url: `${site}${page.path === '/' ? '' : page.path}`,
    site,
    path: page.path,
    image: null,
  };
}

/**
 * The route an exported file serves ("favorites/index.html" → "/favorites",
 * "messages/[id].html" → "/messages/[id]").
 */
export function routeOfFile(file) {
  const r = '/' + String(file).replace(/\\/g, '/').replace(/\.html$/, '').replace(/(^|\/)index$/, '');
  return r.length > 1 ? r.replace(/\/$/, '') : '/';
}

export const isPrivateRoute = (route) => PRIVATE_ROUTES.some((r) => route === r.replace(/\/$/, '') || route.startsWith(r.endsWith('/') ? r : `${r}/`));

/**
 * A signed-in page's exported HTML: the site title (the static render writes
 * none) and "noindex, nofollow", so search engines never list it even when
 * linked from elsewhere. robots.txt only asks crawlers not to fetch it.
 */
export function applyPrivateHead(html, title) {
  if (/name="robots"/.test(html)) return html;
  const tags = [
    /<title[\s>]/.test(html) ? '' : `<title>${escapeText(title)}</title>`,
    '<meta name="robots" content="noindex, nofollow"/>',
  ].join('');
  return html.replace('</head>', () => `${tags}</head>`);
}

export function sitemapXml(site, listings) {
  const url = (loc, lastmod) => `  <url><loc>${escapeText(site + loc)}</loc>${lastmod ? `<lastmod>${String(lastmod).slice(0, 10)}</lastmod>` : ''}</url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_ROUTES.map((r) => url(r)),
    ...listings.map((l) => url(`/property/${l.id}`, l.updated_at)),
    // Public profiles of everyone with a live listing (app/user/[id]).
    ...[...new Set(listings.map((l) => l.owner_id).filter((id) => isListingId(id)))].map((id) => url(`/user/${id}`)),
    '</urlset>',
    '',
  ].join('\n');
}

export function robotsTxt(site) {
  return ['User-agent: *', 'Allow: /', ...PRIVATE_ROUTES.map((r) => `Disallow: ${r}`), '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n');
}

// Exported assets that live under node_modules paths (icon and text fonts).
// Some hosts skip folders named node_modules when uploading a static site, so
// they are moved to /assets/_nm/ and every reference is rewritten.
export const ASSET_FROM = '/assets/node_modules/';
export const ASSET_TO = '/assets/_nm/';
export const relocateAssetRefs = (text) => text.split(ASSET_FROM).join(ASSET_TO);

/** Only real listing ids become file names. */
export const isListingId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

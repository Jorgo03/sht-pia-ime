// Pure helpers for scripts/expo-web-postbuild.mjs (the website built from the
// Expo app). Kept free of I/O so tests/expoWebSeo.test.mjs can check them.

export const SITE_NAME = 'Shtëpia.ime';

// Signed-in pages: kept out of search results.
export const PRIVATE_ROUTES = ['/profile', '/messages', '/favorites', '/my-listings', '/listing/', '/viewings', '/saved-searches', '/agent-dashboard', '/auth/', '/moderation'];
export const PUBLIC_ROUTES = ['/', '/explore', '/privacy', '/terms', '/pricing'];

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
  return { title: full, description: text, url: `${site}/property/${row.id}`, image: image || null };
}

/**
 * Puts a page's own title, description and link-preview tags into the
 * exported template (property/[id].html), replacing the generic ones the
 * static render wrote, and adds a canonical URL.
 */
export function applyHead(html, head) {
  let out = html
    .replace(/<title data-rh="true">[^<]*<\/title>/, `<title data-rh="true">${escapeText(head.title)}</title>`)
    .replace(/<meta data-rh="true" name="description" content="[^"]*"\/>/, `<meta data-rh="true" name="description" content="${escapeAttr(head.description)}"/>`)
    .replace(/<meta data-rh="true" property="og:title" content="[^"]*"\/>/, `<meta data-rh="true" property="og:title" content="${escapeAttr(head.title)}"/>`)
    .replace(/<meta data-rh="true" property="og:description" content="[^"]*"\/>/, `<meta data-rh="true" property="og:description" content="${escapeAttr(head.description)}"/>`);
  const extra = [
    `<link rel="canonical" href="${escapeAttr(head.url)}"/>`,
    `<meta property="og:url" content="${escapeAttr(head.url)}"/>`,
    head.image ? `<meta property="og:image" content="${escapeAttr(head.image)}"/>` : '',
  ].join('');
  out = out.replace('</head>', `${extra}</head>`);
  return out;
}

export function sitemapXml(site, listings) {
  const url = (loc, lastmod) => `  <url><loc>${escapeText(site + loc)}</loc>${lastmod ? `<lastmod>${String(lastmod).slice(0, 10)}</lastmod>` : ''}</url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_ROUTES.map((r) => url(r)),
    ...listings.map((l) => url(`/property/${l.id}`, l.updated_at)),
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

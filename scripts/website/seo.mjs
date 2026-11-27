// Pure helpers for scripts/build-website.mjs: the HTML that search engines
// and link previews read before the site's JavaScript runs. No I/O, so
// tests/websiteSeo.test.mjs can check them.

export const SITE_NAME = 'Shtëpia.ime';

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** Only real listing / profile ids become file names or sitemap entries. */
export const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

/**
 * The site's public address: SITE_URL or EXPO_PUBLIC_SITE_URL when set, else
 * the production domain Vercel exposes to every build. Null when none is
 * known (a local build), and the absolute-URL outputs are then skipped.
 */
export function siteUrl(env) {
  const explicit = clean(env.SITE_URL || env.EXPO_PUBLIC_SITE_URL).replace(/\/+$/, '');
  if (explicit.startsWith('https://')) return explicit;
  const host = clean(env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return host ? `https://${host}` : null;
}

/** Public pages written as their own HTML file, with the title each page sets in the browser. */
export const PUBLIC_PAGES = [
  { path: '/', file: 'index.html', title: (sq) => `${SITE_NAME} | ${lookup(sq, 'site.hero.title')} ${lookup(sq, 'site.hero.titleEm')}` },
  { path: '/search', file: 'search.html', title: (sq) => `${lookup(sq, 'search.title')} | ${SITE_NAME}` },
  { path: '/agents', file: 'agents.html', title: (sq) => `${lookup(sq, 'agents.headlinePre')} ${lookup(sq, 'agents.headlineEm')} | ${SITE_NAME}` },
  { path: '/wanted', file: 'wanted.html', title: (sq) => `${lookup(sq, 'wanted.boardPre')} ${lookup(sq, 'wanted.boardEm')} | ${SITE_NAME}` },
  { path: '/guide', file: 'guide.html', title: (sq) => `${lookup(sq, 'legal.buyingGuide')} | ${SITE_NAME}` },
  { path: '/pricing', file: 'pricing.html', title: (sq) => `${lookup(sq, 'pricing.title')} | ${SITE_NAME}` },
];

/** Pages for a signed-in person, or sign-in itself: never listed by search engines. */
export const PRIVATE_PAGES = [
  'login', 'signup', 'forgot-password', 'account', 'favorites', 'messages', 'viewings', 'compare',
  'saved-searches', 'notifications', 'my-listings', 'listing/new', 'listing/import', 'agent-dashboard',
  'leads', 'performance', 'blocked-users', 'moderation', 'assistant',
];

/** Prefixes robots.txt asks crawlers to skip (the private pages and their sub-pages). */
export const ROBOTS_DISALLOW = [
  '/login', '/signup', '/forgot-password', '/account', '/favorites', '/messages', '/viewings', '/compare',
  '/saved-searches', '/notifications', '/my-listings', '/listing/', '/agent-dashboard', '/leads',
  '/performance', '/blocked-users', '/moderation', '/assistant', '/api/', '/auth/',
];

/** Head values for one listing: "<title> - <city> | Shtëpia.ime", its text and first photo. */
export function listingHead(row, { site, fallbackDescription }) {
  const title = clean(row.title_i18n?.sq || row.title);
  const city = clean(row.city);
  const full = `${title ? (city ? `${title} - ${city}` : title) : SITE_NAME} | ${SITE_NAME}`;
  const description = clean(row.description_i18n?.sq || row.description).slice(0, 160) || fallbackDescription;
  const image = Array.isArray(row.image_urls) ? row.image_urls.find((u) => typeof u === 'string' && u.startsWith('https://')) : null;
  return { title: full, description, url: `${site}/property/${row.id}`, image: image || null, type: 'article' };
}

/**
 * Puts a page's own head into the built index.html: title, description,
 * canonical, Open Graph and Twitter tags (absolute URLs, which link previews
 * need), and "noindex" for private pages. Replacements are functions so "$&"
 * or "$'" in a listing's text stays literal.
 */
export function applyHead(html, head) {
  let out = html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeText(head.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${escapeAttr(head.description)}" />`)
    .replace(/\s*<meta property="og:image" content="[^"]*"\s*\/?>/, '');
  const tags = [
    head.noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    head.url && !head.noindex ? `<link rel="canonical" href="${escapeAttr(head.url)}" />` : '',
    `<meta property="og:type" content="${head.type || 'website'}" />`,
    `<meta property="og:title" content="${escapeAttr(head.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(head.description)}" />`,
    head.url ? `<meta property="og:url" content="${escapeAttr(head.url)}" />` : '',
    head.image ? `<meta property="og:image" content="${escapeAttr(head.image)}" />` : '',
    '<meta property="og:locale" content="sq_AL" />',
    `<meta name="twitter:card" content="${head.image ? 'summary_large_image' : 'summary'}" />`,
  ].filter(Boolean).join('\n    ');
  return out.replace('</head>', () => `    ${tags}\n  </head>`);
}

export function sitemapXml(site, listings) {
  const url = (loc, lastmod) => `  <url><loc>${escapeText(site + loc)}</loc>${lastmod ? `<lastmod>${String(lastmod).slice(0, 10)}</lastmod>` : ''}</url>`;
  const owners = [...new Set(listings.map((l) => l.owner_id).filter(isUuid))];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_PAGES.map((p) => url(p.path === '/' ? '' : p.path)),
    ...['/privacy', '/terms', '/cookies'].map((p) => url(p)),
    ...listings.filter((l) => isUuid(l.id)).map((l) => url(`/property/${l.id}`, l.updated_at)),
    ...owners.map((id) => url(`/user/${id}`)),
    '</urlset>',
    '',
  ].join('\n');
}

export function robotsTxt(site) {
  return ['User-agent: *', 'Allow: /', ...ROBOTS_DISALLOW.map((r) => `Disallow: ${r}`), '', ...(site ? [`Sitemap: ${site}/sitemap.xml`, ''] : [])].join('\n');
}

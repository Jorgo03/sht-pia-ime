import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHead, listingHead, robotsTxt, siteUrl, sitemapXml, isUuid } from '../scripts/website/seo.mjs';

const shell = '<html><head>\n<title>Shtëpia.ime</title>\n<meta name="description" content="old" />\n<meta property="og:image" content="/og-image.png" />\n</head><body></body></html>';
const id = 'd0f83054-7416-4ee8-b141-2a52b8b7a20f';

test('siteUrl prefers an explicit https address, then the Vercel production domain', () => {
  assert.equal(siteUrl({ SITE_URL: 'https://a.al/' }), 'https://a.al');
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' }), 'https://x.vercel.app');
  assert.equal(siteUrl({ SITE_URL: 'http://insecure' }), null);
  assert.equal(siteUrl({}), null);
});

test('applyHead replaces title and description and adds absolute preview tags', () => {
  const html = applyHead(shell, { title: 'T', description: 'D', url: 'https://a.al/search', image: 'https://a.al/og.png' });
  assert.match(html, /<title>T<\/title>/);
  assert.match(html, /name="description" content="D"/);
  assert.match(html, /rel="canonical" href="https:\/\/a.al\/search"/);
  assert.match(html, /og:image" content="https:\/\/a.al\/og.png"/);
  assert.doesNotMatch(html, /content="\/og-image.png"/);
  assert.doesNotMatch(html, /noindex/);
});

test('private pages get noindex and no canonical', () => {
  const html = applyHead(shell, { title: 'T', description: 'D', url: 'https://a.al/account', noindex: true });
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(html, /canonical/);
});

test('listing text with $& and quotes stays literal and escaped', () => {
  const head = listingHead({ id, title: 'Vila "$&" $\' <b>', city: 'Vlorë', description: 'a  b', image_urls: ['http://no', 'https://img/1.jpg'] }, { site: 'https://a.al', fallbackDescription: 'F' });
  const html = applyHead(shell, head);
  assert.match(html, /<title>Vila "\$&amp;" \$' &lt;b&gt; - Vlorë \| Shtëpia.ime<\/title>/);
  assert.match(html, /og:title" content="Vila &quot;\$&amp;&quot;/);
  assert.match(html, /og:image" content="https:\/\/img\/1.jpg"/);
  assert.match(html, /og:url" content="https:\/\/a.al\/property\/d0f83054/);
  assert.equal(head.description, 'a b');
});

test('listing without text falls back to the site description', () => {
  assert.equal(listingHead({ id, title: '' }, { site: 'https://a.al', fallbackDescription: 'F' }).description, 'F');
});

test('sitemap lists public pages, listings and their owners, skipping bad ids', () => {
  const xml = sitemapXml('https://a.al', [{ id, owner_id: id, updated_at: '2026-11-20T10:00:00Z' }, { id: 'bad', owner_id: 'x' }]);
  assert.match(xml, /<loc>https:\/\/a.al<\/loc>/);
  assert.match(xml, /<loc>https:\/\/a.al\/search<\/loc>/);
  assert.match(xml, new RegExp(`/property/${id}</loc><lastmod>2026-11-20</lastmod>`));
  assert.match(xml, new RegExp(`/user/${id}</loc>`));
  assert.doesNotMatch(xml, /bad/);
  assert.ok(isUuid(id) && !isUuid('bad'));
});

test('robots.txt hides private pages and names the sitemap', () => {
  const txt = robotsTxt('https://a.al');
  assert.match(txt, /Disallow: \/account/);
  assert.match(txt, /Disallow: \/listing\//);
  assert.match(txt, /Sitemap: https:\/\/a.al\/sitemap.xml/);
  assert.doesNotMatch(robotsTxt(null), /Sitemap/);
});

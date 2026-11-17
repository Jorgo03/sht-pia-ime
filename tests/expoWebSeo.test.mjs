import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyHead, applyPrivateHead, isListingId, isPrivateRoute, listingHead, relocateAssetRefs, robotsTxt, routeOfFile, sitemapXml,
} from '../scripts/expo-web/seo.mjs'

test('signed-in pages get a title and noindex in their HTML; public ones are found as public', () => {
  assert.equal(routeOfFile('favorites/index.html'), '/favorites')
  assert.equal(routeOfFile('messages\\[id].html'), '/messages/[id]')
  assert.equal(routeOfFile('index.html'), '/')
  assert.equal(routeOfFile('listing/new.html'), '/listing/new')
  for (const r of ['/favorites', '/messages', '/messages/[id]', '/listing/new', '/agent-dashboard', '/performance']) assert.ok(isPrivateRoute(r), r)
  for (const r of ['/', '/explore', '/property/[id]', '/user/[id]', '/agents', '/listings']) assert.ok(!isPrivateRoute(r), r)
  const out = applyPrivateHead('<html><head></head><body></body></html>', 'Shtëpia.ime')
  assert.match(out, /<title>Shtëpia\.ime<\/title><meta name="robots" content="noindex, nofollow"\/><\/head>/)
  assert.equal(applyPrivateHead(out, 'x'), out)
})

// The website built from the Expo app: per-listing pages for search engines
// and link previews (scripts/expo-web-postbuild.mjs).

const SITE = 'https://shtepia.example'
const TEMPLATE = '<html><head><title data-rh="true">Shtëpia.ime — generic</title>'
  + '<meta data-rh="true" name="description" content="generic"/>'
  + '<meta data-rh="true" property="og:title" content="generic"/>'
  + '<meta data-rh="true" property="og:description" content="generic"/>'
  + '</head><body></body></html>'
const ROW = {
  id: 'e2e00000-0000-4000-b000-000000000001',
  title: 'Apartment', title_i18n: { sq: 'Apartament 2+1 në Bllok' },
  description: '  Dritë   e madhe,\nballkon. ', city: 'Tiranë',
  image_urls: ['not-a-url', 'https://cdn.example/1.jpg'], updated_at: '2026-10-20T10:00:00Z',
}

test('a listing gets its Albanian title, city, short description, image and URL', () => {
  const head = listingHead(ROW, { site: SITE, siteDescription: 'site' })
  assert.equal(head.title, 'Apartament 2+1 në Bllok - Tiranë | Shtëpia.ime')
  assert.equal(head.description, 'Dritë e madhe, ballkon.')
  assert.equal(head.image, 'https://cdn.example/1.jpg')
  assert.equal(head.url, `${SITE}/property/${ROW.id}`)
})

test('missing text falls back to the site description and no image tag', () => {
  const head = listingHead({ id: ROW.id, title: 'X', city: null }, { site: SITE, siteDescription: 'site text' })
  assert.equal(head.title, 'X | Shtëpia.ime')
  assert.equal(head.description, 'site text')
  assert.equal(head.image, null)
  assert.doesNotMatch(applyHead(TEMPLATE, head), /og:image/)
})

test('descriptions are capped at 160 characters', () => {
  const head = listingHead({ ...ROW, description_i18n: { sq: 'a'.repeat(300) } }, { site: SITE, siteDescription: '' })
  assert.equal(head.description.length, 160)
})

test('the template head is replaced, escaped, and gains canonical and og:url', () => {
  const html = applyHead(TEMPLATE, { title: 'A <b> & "q"', description: 'D "x" <y>', url: `${SITE}/property/1`, image: `${SITE}/i.jpg?a=1&b=2` })
  assert.match(html, /<title data-rh="true">A &lt;b&gt; &amp; "q"<\/title>/)
  assert.match(html, /name="description" content="D &quot;x&quot; &lt;y&gt;"/)
  assert.match(html, /property="og:title" content="A &lt;b&gt; &amp; &quot;q&quot;"/)
  assert.match(html, /<link rel="canonical" href="https:\/\/shtepia.example\/property\/1"\/>/)
  assert.match(html, /og:image" content="https:\/\/shtepia.example\/i.jpg\?a=1&amp;b=2"/)
  assert.doesNotMatch(html, /generic/)
})

test('the sitemap lists public pages and every listing; robots keeps private pages out', () => {
  const xml = sitemapXml(SITE, [ROW])
  assert.match(xml, /<loc>https:\/\/shtepia.example\/explore<\/loc>/)
  assert.match(xml, new RegExp(`<loc>${SITE}/property/${ROW.id}</loc><lastmod>2026-10-20</lastmod>`))
  assert.doesNotMatch(xml, /\/profile/)
  const robots = robotsTxt(SITE)
  assert.match(robots, /Disallow: \/messages/)
  assert.match(robots, /Disallow: \/moderation/)
  assert.match(robots, /Sitemap: https:\/\/shtepia.example\/sitemap.xml/)
})

test('font paths move out of node_modules everywhere they appear', () => {
  const js = 'a("/assets/node_modules/@expo/x.ttf");b("/assets/node_modules/y.ttf")'
  assert.equal(relocateAssetRefs(js), 'a("/assets/_nm/@expo/x.ttf");b("/assets/_nm/y.ttf")')
})

test('only real listing ids become file names', () => {
  assert.equal(isListingId(ROW.id), true)
  assert.equal(isListingId('../../etc/passwd'), false)
  assert.equal(isListingId('[id]'), false)
})

test('the sitemap lists the public profile of each lister, once', () => {
  const owner = 'e2e00000-0000-4000-a000-0000000000a1'
  const xml = sitemapXml(SITE, [{ ...ROW, owner_id: owner }, { ...ROW, id: 'e2e00000-0000-4000-b000-000000000002', owner_id: owner }])
  assert.equal(xml.match(new RegExp(`/user/${owner}`, 'g')).length, 1)
})

test('"$&" and "$\'" in listing text stay literal in the pre-rendered page', () => {
  const html = applyHead(TEMPLATE, {
    title: "Vila $& me pishinë $' | Shtëpia.ime",
    description: 'Çmimi $& $` $1',
    url: `${SITE}/property/x`,
    site: SITE,
    path: '/property/x',
    image: null,
  })
  assert.match(html, /<title data-rh="true">Vila \$&amp; me pishinë \$' \| Shtëpia\.ime<\/title>/)
  assert.match(html, /name="description" content="Çmimi \$&amp; \$` \$1"/)
  assert.equal((html.match(/<title/g) || []).length, 1)
})

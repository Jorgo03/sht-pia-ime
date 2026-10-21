import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyHead, isListingId, listingHead, relocateAssetRefs, robotsTxt, sitemapXml,
} from '../scripts/expo-web/seo.mjs'

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

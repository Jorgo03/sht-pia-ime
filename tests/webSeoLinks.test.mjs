import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivatePath, languageFromSearch, languageLinks, localizedUrl } from '../lib/web-seo.js'
import { LANGUAGES } from '../i18n/languages.js'
import { applyHead } from '../scripts/expo-web/seo.mjs'

// The website's language links (hreflang) and canonical address. The
// language is not in the path; `?lang=<code>` opens a page in it.

const SITE = 'https://shtepia.example'

test('Albanian is the plain address, other languages add ?lang=', () => {
  assert.equal(localizedUrl(SITE, '/', 'sq'), SITE)
  assert.equal(localizedUrl(SITE, '/explore', 'sq'), `${SITE}/explore`)
  assert.equal(localizedUrl(SITE, '/explore', 'en'), `${SITE}/explore?lang=en`)
  assert.equal(localizedUrl(SITE, '/', 'de'), `${SITE}?lang=de`)
})

test('every shipped language gets an alternate, plus x-default', () => {
  const { canonical, alternates } = languageLinks(SITE, '/terms', 'it')
  assert.equal(canonical, `${SITE}/terms?lang=it`)
  assert.deepEqual(alternates.map((a) => a.hreflang), [...LANGUAGES, 'x-default'])
  assert.equal(alternates.at(-1).href, `${SITE}/terms`)
})

test('an unknown language canonicalises to Albanian', () => {
  assert.equal(languageLinks(SITE, '/', 'xx').canonical, SITE)
})

test('?lang= is read only for shipped languages', () => {
  assert.equal(languageFromSearch('?lang=en'), 'en')
  assert.equal(languageFromSearch('?x=1&lang=fr'), 'fr')
  assert.equal(languageFromSearch('?lang=zz'), null)
  assert.equal(languageFromSearch(''), null)
  assert.equal(languageFromSearch(undefined), null)
})

test('signed-in pages are private', () => {
  for (const p of ['/profile', '/messages/abc', '/listing/new', '/moderation', '/notifications']) assert.equal(isPrivatePath(p), true, p)
  for (const p of ['/', '/explore', '/property/1', '/terms', '/wanted']) assert.equal(isPrivatePath(p), false, p)
})

test('listing pages swap the template links for their own', () => {
  const template = '<html><head><link data-rh="true" rel="canonical" href="https://x/property/[id]"/>'
    + '<link data-rh="true" rel="alternate" hrefLang="en" href="https://x/property/[id]?lang=en"/>'
    + '<meta data-rh="true" property="og:url" content="https://x/property/[id]"/></head></html>'
  const html = applyHead(template, { title: 't', description: 'd', url: `${SITE}/property/1`, site: SITE, path: '/property/1', image: null })
  assert.doesNotMatch(html, /\[id\]/)
  assert.equal(html.match(/rel="canonical"/g).length, 1)
  assert.match(html, /hreflang="en" href="https:\/\/shtepia.example\/property\/1\?lang=en"/)
  assert.match(html, /hreflang="x-default" href="https:\/\/shtepia.example\/property\/1"/)
})

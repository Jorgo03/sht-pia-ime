import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MESSAGES_RETURN_FALLBACK,
  buildInboxHref,
  buildThreadHref,
  parseReturnToken,
  resolveGoBackAction,
  returnRouteForToken,
  tokenForTab,
} from '../src/features/messaging/lib/return-route.js'

test('tabs map to their origin token', () => {
  assert.equal(tokenForTab('index'), 'home')
  assert.equal(tokenForTab('explore'), 'search')
  assert.equal(tokenForTab('profile'), 'profile')
  assert.equal(tokenForTab('unknown'), 'home')
  assert.equal(tokenForTab(null), 'home')
})

test('tokens map to the tab they came from, Home only as fallback', () => {
  assert.equal(returnRouteForToken('home'), '/(tabs)')
  assert.equal(returnRouteForToken('search'), '/(tabs)/explore')
  assert.equal(returnRouteForToken('profile'), '/(tabs)/profile')
  assert.equal(returnRouteForToken('agent'), '/agent-dashboard')
  // Unknown or missing never redirects to a hardcoded Home tab — it lands
  // on the Tabs root, which shows the Tabs navigator\'s active tab.
  assert.equal(returnRouteForToken('nope'), MESSAGES_RETURN_FALLBACK)
  assert.equal(returnRouteForToken(null), MESSAGES_RETURN_FALLBACK)
  assert.equal(returnRouteForToken(undefined), MESSAGES_RETURN_FALLBACK)
})

test('the from param accepts tokens, routes and repeated values', () => {
  assert.equal(parseReturnToken('profile'), 'profile')
  assert.equal(parseReturnToken('/profile'), 'profile')
  assert.equal(parseReturnToken('/(tabs)/explore'), 'search')
  assert.equal(parseReturnToken('/explore'), 'search')
  assert.equal(parseReturnToken('/agent-dashboard'), 'agent')
  assert.equal(parseReturnToken(['search', 'profile']), 'search')
  assert.equal(parseReturnToken('  home  '), 'home')
})

test('the from param rejects URLs, loops and garbage', () => {
  assert.equal(parseReturnToken(undefined), null)
  assert.equal(parseReturnToken(null), null)
  assert.equal(parseReturnToken(''), null)
  assert.equal(parseReturnToken('https://evil.example'), null)
  assert.equal(parseReturnToken('//evil'), null)
  assert.equal(parseReturnToken('/messages'), null)
  assert.equal(parseReturnToken('/messages/abc'), null)
  assert.equal(parseReturnToken('../admin'), null)
  assert.equal(parseReturnToken(42), null)
})

test('inbox hrefs remember the origin without breaking plain links', () => {
  assert.equal(buildInboxHref('profile'), '/messages?from=profile')
  assert.equal(buildInboxHref('/explore'), '/messages?from=search')
  assert.equal(buildInboxHref(undefined), '/messages')
  assert.equal(buildInboxHref('https://evil.example'), '/messages')
})

test('thread hrefs carry the origin forward', () => {
  assert.equal(buildThreadHref('c-1', 'search'), '/messages/c-1?from=search')
  assert.equal(buildThreadHref('c-1', undefined), '/messages/c-1')
  assert.equal(buildThreadHref('c-1', 'bogus'), '/messages/c-1')
})

test('back pops history; only without history does it replace to the origin', () => {
  assert.deepEqual(resolveGoBackAction({ canGoBack: true, from: 'profile' }), {
    kind: 'back',
    token: 'profile',
  })
  assert.deepEqual(resolveGoBackAction({ canGoBack: false, from: 'search' }), {
    kind: 'replace',
    token: 'search',
    href: '/(tabs)/explore',
  })
  assert.deepEqual(resolveGoBackAction({ canGoBack: false, from: undefined }), {
    kind: 'replace',
    token: null,
    href: MESSAGES_RETURN_FALLBACK,
  })
})

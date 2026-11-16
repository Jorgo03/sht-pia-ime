import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isOnline } from '../src/lib/networkState.js'

// AUDIT-009: the phone app did not know when it was offline. Requests failed
// one by one with generic errors, and React Query retried into the void.
// NetInfo now drives React Query's onlineManager (queries pause offline and
// refetch on reconnect) and a banner says the phone is offline.

test('online unless NetInfo says otherwise', () => {
  assert.equal(isOnline({ isConnected: true, isInternetReachable: true }), true)
  // Unknown reachability (null) right after start-up counts as online.
  assert.equal(isOnline({ isConnected: true, isInternetReachable: null }), true)
  assert.equal(isOnline({ isConnected: null, isInternetReachable: null }), true)
  assert.equal(isOnline({ isConnected: false, isInternetReachable: null }), false)
  assert.equal(isOnline({ isConnected: true, isInternetReachable: false }), false)
  assert.equal(isOnline(null), true)
})

test('NetInfo is a dependency at the version Expo SDK 58 bundles', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const bundled = JSON.parse(fs.readFileSync('node_modules/expo/bundledNativeModules.json', 'utf8'))
  assert.ok(pkg.dependencies['@react-native-community/netinfo'], 'dependency')
  assert.match(pkg.dependencies['@react-native-community/netinfo'], new RegExp(bundled['@react-native-community/netinfo'].replace(/[~^]/, '').replace(/\./g, '\\.')))
})

test('the app wires NetInfo into onlineManager and shows the banner', () => {
  const online = fs.readFileSync('lib/online-manager.ts', 'utf8')
  assert.match(online, /onlineManager\.setEventListener\(/)
  assert.match(online, /NetInfo\.addEventListener\(/)
  const layout = fs.readFileSync('app/_layout.tsx', 'utf8')
  assert.match(layout, /<OfflineBanner \/>/)
  assert.match(layout, /from '@\/lib\/online-manager'/)
})

test('the offline message exists in all 8 locales', () => {
  for (const l of ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    const j = JSON.parse(fs.readFileSync(`src/i18n/locales/${l}.json`, 'utf8'))
    assert.equal(typeof j.errors.offline, 'string', l)
  }
})

test('phones use NetInfo; the website keeps the browser listener of React Query', () => {
  const online = fs.readFileSync('lib/online-manager.ts', 'utf8')
  assert.match(online, /if \(Platform\.OS !== 'web'\) \{\s+onlineManager\.setEventListener/)
  assert.doesNotMatch(online, /NetInfo\.configure|reachabilityUrl/)
})

test('the banner reads the same online state as React Query and never blocks taps', () => {
  const banner = fs.readFileSync('components/ui/offline-banner.tsx', 'utf8')
  assert.match(banner, /useSyncExternalStore\(subscribe, getOnline, getServerOnline\)/)
  assert.match(banner, /pointerEvents: 'none'/)
})

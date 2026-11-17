import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadNotifications } from '../src/features/notifications/lib/loadNotifications.js'

// lib/notifications-module.ts: expo-notifications must never take the app
// down where its native code is missing (Samsung A23 in Expo Go, SDK 58:
// "Cannot find native module 'ExpoTopicSubscriptionModule'").

const MOD = { setNotificationHandler() {} }
const base = { platform: 'android', inExpoGo: false, hasNativeModule: () => true, load: () => MOD }

test('a store or development build on Android loads the package', () => {
  assert.equal(loadNotifications(base), MOD)
})

test('Expo Go on Android never loads it', () => {
  let loaded = false
  assert.equal(loadNotifications({ ...base, inExpoGo: true, load: () => { loaded = true; return MOD } }), null)
  assert.equal(loaded, false)
})

test('a missing native module on Android means no load, whatever the environment says', () => {
  const asked = []
  let loaded = false
  const result = loadNotifications({
    ...base,
    hasNativeModule: (name) => { asked.push(name); return false },
    load: () => { loaded = true; return MOD },
  })
  assert.equal(result, null)
  assert.equal(loaded, false)
  assert.deepEqual(asked, ['ExpoTopicSubscriptionModule'])
})

test('a load that throws is reported and the app carries on', () => {
  const errors = []
  const result = loadNotifications({
    ...base,
    load: () => { throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'") },
    onError: (e) => errors.push(e.message),
  })
  assert.equal(result, null)
  assert.equal(errors.length, 1)
})

test('iOS, including Expo Go on iOS, still loads it', () => {
  assert.equal(loadNotifications({ ...base, platform: 'ios', inExpoGo: true, hasNativeModule: () => false }), MOD)
})

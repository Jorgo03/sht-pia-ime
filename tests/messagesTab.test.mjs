import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// Messages is a real bottom tab: the person moves on from it through the
// menu. Android's hardware back cannot be pressed in the web e2e suite, so
// its wiring is pinned here; X72 and X73 cover the flow itself.

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('the inbox is a tab, between Search and Profile', () => {
  const tabs = read('app/(tabs)/_layout.tsx')
  const order = ['name="explore"', 'name="messages"', 'name="profile"'].map((n) => tabs.indexOf(n))
  assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2], 'tab order')
  assert.equal(fs.existsSync(new URL('../app/messages/index.tsx', import.meta.url)), false)
})

test('on Android the back button stays in the inbox while it is focused', () => {
  const inbox = read('app/(tabs)/messages.tsx')
  assert.match(inbox, /Platform\.OS !== 'android'/)
  assert.match(inbox, /addEventListener\('hardwareBackPress', \(\) => true\)/)
  assert.match(inbox, /sub\.remove\(\)/, 'released when the list leaves the screen')
})

test('a chat returns to the inbox, never to a remembered tab', () => {
  const chat = read('app/messages/[id].tsx')
  assert.match(chat, /router\.replace\('\/messages' as Href\)/)
  assert.doesNotMatch(chat, /return-route|useLocalSearchParams<\{[^}]*from/)
})

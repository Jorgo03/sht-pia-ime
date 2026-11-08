import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conversationInPath, notificationCopy, notificationRoute, shouldBanner } from '../src/features/notifications/lib/feed.js'
import { buildPush, dispatchEnabled, safeRoute, stillWanted } from '../supabase/functions/push-dispatch/logic.js'
import { readFileSync } from 'node:fs'

const CONV = '00000000-0000-4000-8000-000000000001'
const PROP = '00000000-0000-4000-8000-000000000002'
const t = (k, o) => k + (o ? JSON.stringify(o) : '')
const sq = JSON.parse(readFileSync(new URL('../src/i18n/locales/sq.json', import.meta.url), 'utf8'))

test('a tap goes to the conversation, the viewings or the property', () => {
  assert.equal(notificationRoute({ kind: 'message', data: { conversation_id: CONV } }), `/messages/${CONV}`)
  assert.equal(notificationRoute({ kind: 'inquiry', data: { conversation_id: CONV } }), `/messages/${CONV}`)
  assert.equal(notificationRoute({ kind: 'viewing_updated', data: {} }), '/viewings')
  assert.equal(notificationRoute({ kind: 'listing_hidden', data: { property_id: PROP } }), `/property/${PROP}`)
  assert.equal(notificationRoute({ kind: 'announcement', data: {} }), null)
  assert.equal(notificationRoute({ kind: 'message', data: { conversation_id: '../../evil' } }), null)
})

test('the words depend on what is known, and every key exists', () => {
  assert.match(notificationCopy({ kind: 'message', data: { sender_name: 'Arta' } }, t).body, /kinds.message.body/)
  assert.match(notificationCopy({ kind: 'message', data: { sender_name: 'Arta', count: 3 } }, t).body, /bodyMany/)
  assert.match(notificationCopy({ kind: 'message', data: {} }, t).body, /bodyNoName/)
  assert.match(notificationCopy({ kind: 'viewing_updated', data: { status: 'confirmed' } }, t).body, /confirmed/)
  assert.match(notificationCopy({ kind: 'viewing_updated', data: { status: 'odd' } }, t).body, /updated/)
  assert.deepEqual(notificationCopy({ kind: 'announcement', data: { title: 'T', body: 'B' } }, t), { title: 'T', body: 'B' })
  const realT = (k) => k.split('.').reduce((o, p) => o?.[p], sq)
  for (const kind of ['viewing_requested', 'listing_hidden', 'listing_restored', 'welcome']) {
    const c = notificationCopy({ kind, data: {} }, realT)
    assert.ok(c.title && c.body, kind)
  }
})

test('a banner appears only for something new and not already on screen', () => {
  const now = Date.parse('2026-11-08T12:00:00Z')
  const fresh = { read_at: null, created_at: '2026-11-08T11:59:50Z', kind: 'message', data: { conversation_id: CONV } }
  assert.equal(shouldBanner(fresh, { pathname: '/', now }), true)
  assert.equal(shouldBanner(fresh, { pathname: `/messages/${CONV}`, now }), false, 'already reading it')
  assert.equal(shouldBanner({ ...fresh, read_at: '2026-11-08T11:59:55Z' }, { pathname: '/', now }), false)
  assert.equal(shouldBanner({ ...fresh, created_at: '2026-11-08T11:00:00Z' }, { pathname: '/', now }), false, 'old')
  assert.equal(shouldBanner(fresh, { pathname: '/', now, prefs: { messages: false } }), false, 'switched off')
  assert.equal(conversationInPath('/messages'), null)
})

test('the sender knows every kind, is off when switched off, and keeps routes safe', () => {
  assert.equal(dispatchEnabled({}, false), false)
  assert.equal(dispatchEnabled({}, true), true)
  assert.equal(buildPush({ kind: 'inquiry', data: { conversation_id: CONV }, lang: 'en', senderName: 'Arta Hoxha' }).body, 'New inquiry about your property from Arta')
  assert.equal(buildPush({ kind: 'listing_hidden', data: { property_id: PROP }, lang: 'sq' }).url, `/property/${PROP}`)
  assert.equal(buildPush({ kind: 'announcement', data: { title: 'A', body: 'B' }, lang: 'sq' }).title, 'A')
  assert.equal(safeRoute(`/property/${PROP}`), `/property/${PROP}`)
  assert.equal(safeRoute('/notifications'), '/notifications')
  assert.equal(safeRoute('/profile'), '/')
  assert.equal(stillWanted('inquiry', { messages: false }), false)
  assert.equal(stillWanted('announcement', { messages: false, viewings: false }), true)
})

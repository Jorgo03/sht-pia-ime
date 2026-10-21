import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPush, chunk, dispatchEnabled, firstName, readTickets, safeRoute } from '../supabase/functions/push-dispatch/logic.js'

// Push notifications (docs/LAUNCH_TASKS.md F14): what a lock screen may show,
// where a tap goes, and handling Expo's answers.

const CONV = '00000000-0000-4000-8000-000000000001'

test('off unless the owner switches it on', () => {
  assert.equal(dispatchEnabled({}), false)
  assert.equal(dispatchEnabled({ PUSH_DISPATCH_ENABLED: '1' }), false)
  assert.equal(dispatchEnabled({ PUSH_DISPATCH_ENABLED: 'true' }), true)
})

test('a message push names the sender by first name and never carries the text', () => {
  const p = buildPush({ kind: 'message', data: { conversation_id: CONV, body: 'secret' }, lang: 'en', senderName: 'Arta Hoxha' })
  assert.deepEqual(p, { title: 'Shtëpia.ime', body: 'New message from Arta', url: `/messages/${CONV}` })
  assert.doesNotMatch(JSON.stringify(p), /secret|Hoxha/)
  assert.equal(buildPush({ kind: 'message', data: { conversation_id: CONV }, lang: 'sq', senderName: null }).body, 'Mesazh i ri')
})

test('viewing pushes say what happened, in the person\'s language', () => {
  assert.equal(buildPush({ kind: 'viewing_requested', data: {}, lang: 'de' }).body, 'Neue Besichtigungsanfrage')
  assert.equal(buildPush({ kind: 'viewing_updated', data: { status: 'confirmed' }, lang: 'sq' }).body, 'Vizita juaj u konfirmua')
  assert.equal(buildPush({ kind: 'viewing_updated', data: { status: 'no_show' }, lang: 'xx' }).body, 'A viewing was updated')
  assert.equal(buildPush({ kind: 'viewing_updated', data: { status: 'declined' }, lang: 'en' }).url, '/viewings')
})

test('first names are trimmed and bounded', () => {
  assert.equal(firstName('  Ana   Maria '), 'Ana')
  assert.equal(firstName(''), '')
  assert.equal(firstName('x'.repeat(100)).length, 40)
})

test('batches of 100 for Expo', () => {
  const parts = chunk(Array.from({ length: 250 }, (_, i) => i))
  assert.deepEqual(parts.map((p) => p.length), [100, 100, 50])
})

test('tokens Expo no longer knows are reported for removal', () => {
  const tickets = [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }]
  assert.deepEqual(readTickets(tickets, ['a', 'b', 'c']), { ok: 1, deadTokens: ['b'] })
  assert.deepEqual(readTickets(undefined, []), { ok: 0, deadTokens: [] })
})

test('a tap can only open known screens', () => {
  assert.equal(safeRoute(`/messages/${CONV}`), `/messages/${CONV}`)
  assert.equal(safeRoute('/viewings'), '/viewings')
  for (const bad of ['https://evil.example', '/messages/../admin', '//evil', null, '/profile']) assert.equal(safeRoute(bad), '/')
})

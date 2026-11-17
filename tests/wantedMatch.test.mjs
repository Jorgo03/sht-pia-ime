import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { notificationCopy, notificationRoute } from '../src/features/notifications/lib/feed.js'
import { buildPush } from '../supabase/functions/push-dispatch/logic.js'

// AUDIT-025: nothing told a buyer when a listing matching their "wanted home"
// was published. The database now queues a `wanted_match` notification
// (migration *_wanted_home_match_alerts.sql); the feed, the push and both
// apps must understand that kind.

const PID = '0b5c3f0e-1111-4222-8333-444455556666'

test('a wanted_match opens the listing', () => {
  assert.equal(notificationRoute({ kind: 'wanted_match', data: { property_id: PID } }), `/property/${PID}`)
  assert.equal(notificationRoute({ kind: 'wanted_match', data: { property_id: 'nope' } }), '/saved-searches')
})

test('the feed has its own title and body', () => {
  const t = (k) => k
  assert.deepEqual(notificationCopy({ kind: 'wanted_match', data: { property_id: PID } }, t), {
    title: 'notifications.kinds.wanted_match.title',
    body: 'notifications.kinds.wanted_match.body',
  })
})

test('the push names no address or price, in every language', () => {
  for (const lang of ['sq', 'en', 'de', 'it', 'es', 'fr', 'pl', 'ru']) {
    const p = buildPush({ kind: 'wanted_match', data: { property_id: PID }, lang })
    assert.equal(p.title, 'Shtëpia.ime')
    assert.ok(p.body.length > 10, lang)
    assert.equal(p.url, `/property/${PID}`)
  }
  assert.match(buildPush({ kind: 'wanted_match', data: { property_id: PID }, lang: 'sq' }).body, /kërk/)
})

test('the copy exists in all 8 locales', () => {
  for (const l of ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    const j = JSON.parse(fs.readFileSync(`src/i18n/locales/${l}.json`, 'utf8'))
    assert.equal(typeof j.notifications.kinds.wanted_match?.title, 'string', l)
    assert.equal(typeof j.notifications.kinds.wanted_match?.body, 'string', l)
  }
})

test('the migration adds the kind and a trigger that never blocks publishing', () => {
  const file = fs.readdirSync('supabase/migrations').find((f) => f.endsWith('_wanted_home_match_alerts.sql'))
  assert.ok(file, 'migration file')
  const sql = fs.readFileSync(`supabase/migrations/${file}`, 'utf8')
  assert.match(sql, /'wanted_match'/)
  assert.match(sql, /create trigger properties_notify_wanted_matches/)
  assert.match(sql, /exception when others then\s+return new;/)
  assert.match(sql, /security definer/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createCatchUp, mergeMessages } from '../src/features/messaging/lib/catchUp.js'

// AUDIT-024: Supabase Realtime does not replay rows missed while the channel
// was down or the app was in the background. A thread left open (and the
// unread badge) must re-read when the channel subscribes again and when the
// app comes back to the foreground.

test('the first subscribe is not a catch-up; every later one is', () => {
  let n = 0
  const c = createCatchUp(() => n++)
  c.onStatus('SUBSCRIBED')
  assert.equal(n, 0)
  c.onStatus('CHANNEL_ERROR')
  c.onStatus('TIMED_OUT')
  assert.equal(n, 0)
  c.onStatus('SUBSCRIBED')
  assert.equal(n, 1)
})

test('coming back to the foreground catches up; staying active does not', () => {
  let n = 0
  const c = createCatchUp(() => n++)
  c.onAppState('active')
  assert.equal(n, 0)
  c.onAppState('background')
  c.onAppState('active')
  assert.equal(n, 1)
  c.onAppState('inactive')
  c.onAppState('active')
  assert.equal(n, 2)
})

test('merging keeps every message once, oldest first', () => {
  const m = (id, t) => ({ id, created_at: `2026-11-13T10:0${t}:00Z` })
  const prev = [m('a', 1), m('b', 2), m('x', 5)]
  const fresh = [m('b', 2), m('c', 3), m('d', 4)]
  assert.deepEqual(mergeMessages(prev, fresh).map((x) => x.id), ['a', 'b', 'c', 'd', 'x'])
  assert.deepEqual(mergeMessages([], null), [])
})

test('the thread and the unread badge use it, with an AppState listener', () => {
  for (const f of ['app/messages/[id].tsx', 'hooks/use-unread-messages.ts']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /createCatchUp\(/, f)
    assert.match(src, /\.subscribe\(\(status\) => catchUp\.onStatus\(status\)\)/, f)
    assert.match(src, /AppState\.addEventListener\('change', catchUp\.onAppState\)/, f)
    assert.match(src, /appStateSub\.remove\(\)/, f)
  }
})

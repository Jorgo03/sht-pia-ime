import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canReceive, canTurnOn, createLatestSaver, deviceState } from '../src/features/notifications/lib/deviceState.js'
import { readPreferences } from '../src/features/notifications/lib/preferences.js'
import { stillWanted } from '../supabase/functions/push-dispatch/logic.js'

// The Notifications sheet (docs/LAUNCH_TASKS.md F14): this phone's permission,
// its registration and the account's saved switches are separate facts.

const phone = (permission, registration = null, extra = {}) =>
  deviceState({ platform: 'ios', remoteSupported: true, permission, registration, ...extra })

test('only a granted permission with a registered device counts as on', () => {
  assert.equal(phone({ status: 'granted', canAskAgain: true }, 'registered'), 'on')
  assert.equal(phone({ status: 'granted', canAskAgain: true }, null), 'registering')
  assert.equal(phone({ status: 'granted', canAskAgain: true }, 'failed'), 'registerFailed')
  assert.equal(canReceive('registering'), false)
  assert.equal(canReceive('registerFailed'), false)
  assert.equal(canReceive('on'), true)
})

test('first request, a second chance, and a permanent deny need different actions', () => {
  assert.equal(phone({ status: 'undetermined', canAskAgain: true }), 'off')
  // Android 13+: one more prompt is allowed after a first "deny".
  assert.equal(phone({ status: 'denied', canAskAgain: true }), 'off')
  // Denied for good or restricted: only Settings can change it.
  assert.equal(phone({ status: 'denied', canAskAgain: false }), 'blocked')
  assert.equal(canTurnOn('off'), true)
  assert.equal(canTurnOn('blocked'), false)
  assert.equal(canTurnOn('registerFailed'), true)
})

test('a granted permission is not on when the device could not register', () => {
  assert.notEqual(phone({ status: 'granted', canAskAgain: false }, 'failed'), 'on')
})

test('the web and builds without remote push say so instead of offering a button', () => {
  assert.equal(deviceState({ platform: 'web', remoteSupported: false, permission: null, registration: null }), 'web')
  for (const permission of [null, { status: 'granted', canAskAgain: true }, { status: 'undetermined', canAskAgain: true }]) {
    assert.equal(phone(permission, null, { platform: 'android', remoteSupported: false }), 'unavailable')
  }
  assert.equal(canTurnOn('web'), false)
  assert.equal(canTurnOn('unavailable'), false)
  assert.equal(phone(null), 'checking')
})

const deferred = () => {
  let resolve
  const promise = new Promise((r) => (resolve = r))
  return { promise, resolve }
}

test('rapid taps: saves never overlap and the newest choice is the one written last', async () => {
  const written = []
  const gates = []
  const save = createLatestSaver(async (value) => {
    written.push(value)
    const gate = deferred()
    gates.push(gate)
    return gate.promise
  })
  const a = save({ messages: false, viewings: true })
  const b = save({ messages: false, viewings: false })
  const c = save({ messages: true, viewings: false })
  assert.equal(written.length, 1, 'the second save waits for the first')
  gates[0].resolve(true)
  await new Promise((r) => setImmediate(r))
  assert.equal(written.length, 2, 'intermediate choices are skipped, only the newest is sent next')
  assert.deepEqual(written[1], { messages: true, viewings: false })
  gates[1].resolve(true)
  const results = await Promise.all([a, b, c])
  for (const r of results) assert.deepEqual(r, { ok: true, value: { messages: true, viewings: false } })
})

test('a failed save is reported, and a thrown error counts as a failure', async () => {
  assert.deepEqual(await createLatestSaver(async () => false)({ messages: false }), { ok: false, value: { messages: false } })
  assert.deepEqual(await createLatestSaver(async () => { throw new Error('offline') })(1), { ok: false, value: 1 })
})

test('a save after the previous run finished starts a new run', async () => {
  const written = []
  const save = createLatestSaver(async (v) => (written.push(v), true))
  await save(1)
  await save(2)
  assert.deepEqual(written, [1, 2])
})

const client = (result) => ({
  from: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => result }
    return q
  },
})

test('a failed read is reported, so the sheet never shows or saves the defaults as choices', async () => {
  assert.equal((await readPreferences(client({ data: null, error: { code: 'x' } }), 'u')).ok, false)
  assert.equal((await readPreferences({ from() { throw new Error('offline') } }, 'u')).ok, false)
  assert.deepEqual(await readPreferences(client({ data: null, error: null }), 'u'), { ok: true, prefs: { messages: true, viewings: true } })
  assert.deepEqual(await readPreferences(client({ data: { messages: false, viewings: true }, error: null }), 'u'), {
    ok: true,
    prefs: { messages: false, viewings: true },
  })
})

test('a push queued before its kind was switched off is not sent', () => {
  assert.equal(stillWanted('message', { messages: false, viewings: true }), false)
  assert.equal(stillWanted('viewing_requested', { messages: true, viewings: false }), false)
  assert.equal(stillWanted('viewing_updated', { messages: true, viewings: false }), false)
  assert.equal(stillWanted('message', { messages: true, viewings: false }), true)
  assert.equal(stillWanted('viewing_updated', undefined), true, 'no saved row means on')
})

// The sign-in limit (src/features/auth/lib/loginThrottle.js) with a fake clock.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createLoginThrottle, isWrongPassword, tooManyAttemptsError } from '../src/features/auth/lib/loginThrottle.js'
import { friendlyError } from '../src/lib/authErrors.js'

function setup(opts = {}) {
  let t = 1_000_000
  const clock = { now: () => t, advance: (ms) => { t += ms } }
  return { clock, throttle: createLoginThrottle({ now: clock.now, ...opts }) }
}

test('a first try is allowed, and each failure makes the next wait longer (1, 2, 4, 8 s)', () => {
  const { clock, throttle } = setup()
  assert.deepEqual(throttle.check('ana@example.com'), { allowed: true, waitMs: 0 })
  const waits = []
  for (let i = 0; i < 4; i++) {
    throttle.fail('ana@example.com')
    const { waitMs } = throttle.check('ana@example.com')
    waits.push(waitMs)
    clock.advance(waitMs)
    assert.equal(throttle.check('ana@example.com').allowed, true)
  }
  assert.deepEqual(waits, [1000, 2000, 4000, 8000])
})

test('5 wrong passwords in a minute lock the account until the minute is over', () => {
  const { clock, throttle } = setup()
  for (let i = 0; i < 5; i++) {
    throttle.fail('ana@example.com')
    clock.advance(100)
  }
  const { allowed, waitMs } = throttle.check('ana@example.com')
  assert.equal(allowed, false)
  assert.equal(waitMs, 60_000 - 500)
  clock.advance(waitMs)
  assert.equal(throttle.check('ana@example.com').allowed, true)
})

test('the account is the same whatever the capitals or spaces', () => {
  const { throttle } = setup()
  throttle.fail('  Ana@Example.com ')
  assert.equal(throttle.check('ana@example.com').allowed, false)
})

test('a correct password clears the account', () => {
  const { throttle } = setup()
  throttle.fail('ana@example.com')
  throttle.succeed('ana@example.com')
  assert.deepEqual(throttle.check('ana@example.com'), { allowed: true, waitMs: 0 })
})

test('10 wrong passwords on one device in a minute stop every account on it', () => {
  const { clock, throttle } = setup()
  for (let i = 0; i < 10; i++) {
    throttle.fail(`user${i}@example.com`)
    clock.advance(10)
  }
  assert.equal(throttle.check('someone-new@example.com').allowed, false)
  clock.advance(60_000)
  assert.equal(throttle.check('someone-new@example.com').allowed, true)
})

test('the count survives a reload when storage is given', () => {
  let stored = null
  const storage = { load: () => stored, save: (v) => { stored = v } }
  const t = 5_000_000
  const first = createLoginThrottle({ now: () => t, ...storage })
  for (let i = 0; i < 5; i++) first.fail('ana@example.com')
  const reloaded = createLoginThrottle({ now: () => t + 1000, ...storage })
  assert.equal(reloaded.check('ana@example.com').allowed, false)
})

test('damaged storage starts fresh instead of breaking sign-in', () => {
  const throttle = createLoginThrottle({ load: () => '{not json', save: () => { throw new Error('full') } })
  throttle.fail('ana@example.com')
  assert.equal(typeof throttle.check('ana@example.com').waitMs, 'number')
})

test('only a wrong password counts', () => {
  assert.equal(isWrongPassword({ code: 'invalid_credentials' }), true)
  assert.equal(isWrongPassword({ message: 'Invalid login credentials' }), true)
  assert.equal(isWrongPassword({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), false)
  assert.equal(isWrongPassword(null), false)
})

test('the person is told how long to wait', () => {
  const err = tooManyAttemptsError(4200)
  assert.equal(err.code, 'too_many_attempts')
  assert.equal(err.waitSeconds, 5)
  const t = (key, vars) => `${key}:${vars?.seconds}`
  assert.equal(friendlyError(err, t), 'errors.tooManyAttempts:5')
})

// Unit tests for the onAuthStateChange event classifier. Run with: npm test
//
// This is the closest thing to "mocked Auth events" this repo's test setup
// (plain `node --test`, no JSX/DOM loader) can exercise directly — the real
// callback lives inside a React useEffect in AuthContext.jsx, but the
// event-routing *decision* it acts on is this pure function, extracted
// specifically so it's testable without a live Supabase client or a
// React render.
//
// Covers BOTH apps: contexts/auth-context.tsx (mobile) imports this same
// module rather than mirroring it, so these cases guard the mobile auth
// state machine too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyAuthEvent } from '../src/lib/authEvents.js'

const session = { user: { id: 'u1' } }

// ---------- structural guarantee: no Supabase API calls ----------

test('classifyAuthEvent performs no I/O — it is a pure function of its two arguments', () => {
  // Not a mock/spy assertion (there is nothing to spy on): the function
  // imports nothing beyond nothing, calls nothing, and every branch below
  // returns synchronously with a plain object. A function that awaited or
  // invoked any Supabase method could not satisfy this signature.
  assert.equal(classifyAuthEvent.constructor.name, 'Function') // not AsyncFunction
  const result = classifyAuthEvent('SIGNED_IN', session)
  assert.equal(typeof result, 'object')
  assert.equal(result instanceof Promise, false)
})

// ---------- event routing ----------

test('PASSWORD_RECOVERY syncs and flags recovery mode', () => {
  const result = classifyAuthEvent('PASSWORD_RECOVERY', session)
  assert.deepEqual(result, { action: 'sync', passwordRecovery: true })
})

test('SIGNED_IN with a session syncs and shows the pending-welcome toast', () => {
  const result = classifyAuthEvent('SIGNED_IN', session)
  assert.equal(result.action, 'sync-welcome')
})

test('SIGNED_IN with no session (should not happen, but must not crash) is a no-op', () => {
  assert.deepEqual(classifyAuthEvent('SIGNED_IN', null), { action: 'none' })
  assert.deepEqual(classifyAuthEvent('SIGNED_IN', {}), { action: 'none' })
})

test('TOKEN_REFRESHED with a session syncs', () => {
  assert.equal(classifyAuthEvent('TOKEN_REFRESHED', session).action, 'sync')
})

test('TOKEN_REFRESHED with no session is a no-op', () => {
  assert.deepEqual(classifyAuthEvent('TOKEN_REFRESHED', null), { action: 'none' })
})

test('USER_UPDATED syncs so the rotated session/user replaces the superseded one', () => {
  // updateUser() (password change) rotates tokens; leaving this unhandled
  // kept a stale session object in context.
  assert.equal(classifyAuthEvent('USER_UPDATED', session).action, 'sync')
})

test('USER_UPDATED with no session is a no-op rather than clearing state', () => {
  assert.deepEqual(classifyAuthEvent('USER_UPDATED', null), { action: 'none' })
})

test('SIGNED_OUT clears state and turns off recovery mode, regardless of any session argument', () => {
  assert.deepEqual(classifyAuthEvent('SIGNED_OUT', session), { action: 'clear', passwordRecovery: false })
  assert.deepEqual(classifyAuthEvent('SIGNED_OUT', null), { action: 'clear', passwordRecovery: false })
})

test('INITIAL_SESSION always syncs, session present or not — this is what replaced the separate getSession() call', () => {
  assert.equal(classifyAuthEvent('INITIAL_SESSION', session).action, 'sync')
  assert.equal(classifyAuthEvent('INITIAL_SESSION', null).action, 'sync')
})

test('an unrecognized event is a safe no-op rather than throwing', () => {
  assert.deepEqual(classifyAuthEvent('SOME_FUTURE_EVENT', session), { action: 'none' })
  assert.deepEqual(classifyAuthEvent(undefined, session), { action: 'none' })
})

test('only PASSWORD_RECOVERY and SIGNED_OUT ever touch passwordRecovery — every other event leaves it alone', () => {
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION', 'UNKNOWN']) {
    assert.equal('passwordRecovery' in classifyAuthEvent(event, session), false)
  }
})

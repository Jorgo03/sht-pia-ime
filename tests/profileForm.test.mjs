import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidPhone, profilePatch, saveProfile } from '../src/features/auth/lib/profileForm.js'

// "Edit profile" (docs/LAUNCH_TASKS.md L12). These pin what the form may write:
// only changed fields, never role, agency only for agents, and a phone shape
// that matches the database check in supabase/pending/profile_phone_update.sql.

test('phone numbers: local, international and empty are fine', () => {
  for (const ok of ['+355 69 123 4567', '069 123 4567', '+39 (333) 123-4567', '', null]) {
    assert.equal(isValidPhone(ok), true, String(ok))
  }
  for (const bad of ['12345', 'call me', '+355 69 123 4567 ext 9', '++355691234567', '+'.padEnd(40, '1')]) {
    assert.equal(isValidPhone(bad), false, bad)
  }
})

test('only changed fields are sent, so a name change works without the phone grant', () => {
  const current = { full_name: 'Arta Hoxha', phone: '+355 69 000 0000', agency_name: 'Arta Homes', role: 'agent' }
  const { patch, error } = profilePatch(current, { ...current, full_name: '  Arta   Hoxha-Kola ' }, { isAgent: true })
  assert.equal(error, null)
  assert.deepEqual(patch, { full_name: 'Arta Hoxha-Kola' })
})

test('clearing the phone sends null, and an unchanged form sends nothing', () => {
  const current = { full_name: 'Ben', phone: '+355 69 000 0000' }
  assert.deepEqual(profilePatch(current, { full_name: 'Ben', phone: '  ' }).patch, { phone: null })
  assert.deepEqual(profilePatch(current, { full_name: 'Ben', phone: '+355 69 000 0000' }).patch, {})
})

test('a client form never writes agency, and no form writes role', () => {
  const { patch } = profilePatch({ full_name: 'Ben' }, { full_name: 'Ben', agency_name: 'Fake Agency', role: 'agent' })
  assert.deepEqual(patch, {})
})

test('refuses an empty name, an over-long field and a bad phone', () => {
  assert.equal(profilePatch({}, { full_name: '   ' }).error, 'nameRequired')
  assert.equal(profilePatch({}, { full_name: 'x'.repeat(81) }).error, 'tooLong')
  assert.equal(profilePatch({}, { full_name: 'Ben', agency_name: 'y'.repeat(81) }, { isAgent: true }).error, 'tooLong')
  assert.equal(profilePatch({}, { full_name: 'Ben', phone: 'none' }).error, 'phoneInvalid')
})

test('save: nothing to send, success and a refused update', async () => {
  assert.equal(await saveProfile({ from() { throw new Error('must not be called') } }, 'u1', {}), 'unchanged')
  const calls = []
  const client = (error) => ({
    from(t) { calls.push(t); return { update(p) { calls.push(p); return { eq: async (c, v) => { calls.push([c, v]); return { error } } } } } },
  })
  assert.equal(await saveProfile(client(null), 'u1', { phone: null }), 'saved')
  assert.deepEqual(calls, ['profiles', { phone: null }, ['id', 'u1']])
  assert.equal(await saveProfile(client({ code: '42501' }), 'u1', { phone: '+355 69 1' }), 'failed')
  assert.equal(await saveProfile({ from() { throw new Error('offline') } }, 'u1', { full_name: 'x' }), 'failed')
})

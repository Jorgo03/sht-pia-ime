import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appleFullName } from '../src/features/auth/lib/appleName.js'

// Sign in with Apple (F8): the name Apple sends once, turned into full_name.

test('given, middle and family names join with single spaces', () => {
  assert.equal(appleFullName({ givenName: 'Ana', middleName: null, familyName: 'Hoxha' }), 'Ana Hoxha')
  assert.equal(appleFullName({ givenName: ' Ana ', middleName: 'M.', familyName: '  Hoxha' }), 'Ana M. Hoxha')
})

test('one part is enough', () => {
  assert.equal(appleFullName({ givenName: 'Ana', familyName: null }), 'Ana')
  assert.equal(appleFullName({ familyName: 'Hoxha' }), 'Hoxha')
})

test('later sign-ins (no name) give null, so nothing is overwritten', () => {
  assert.equal(appleFullName(null), null)
  assert.equal(appleFullName(undefined), null)
  assert.equal(appleFullName({ givenName: null, middleName: null, familyName: null }), null)
  assert.equal(appleFullName({ givenName: '  ', familyName: '' }), null)
})

test('the name is capped at the profile limit of 80 characters', () => {
  const name = appleFullName({ givenName: 'A'.repeat(60), familyName: 'B'.repeat(60) })
  assert.equal(name.length, 80)
  assert.equal(name.endsWith(' '), false)
})

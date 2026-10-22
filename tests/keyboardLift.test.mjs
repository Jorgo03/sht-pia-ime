import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keyboardLift } from '../src/lib/keyboardLift.js'

// The "U krye" bar sits exactly on the keyboard (components/ui/keyboard-done-bar.tsx).

test('a screen without a KeyboardAvoidingView: the bar rises by the part the keyboard covers', () => {
  // iPhone SE (667pt): keyboard top at 451 (216pt keypad), screen bottom at 667.
  assert.equal(keyboardLift({ containerBottom: 667, keyboardTop: 451 }), 216)
})

test('inside a KeyboardAvoidingView (or on Android, which resizes): no lift, no double inset', () => {
  assert.equal(keyboardLift({ containerBottom: 451, keyboardTop: 451 }), 0)
  // A container ending above the keyboard (a sheet with its own padding) never lifts down.
  assert.equal(keyboardLift({ containerBottom: 400, keyboardTop: 451 }), 0)
})

test('fractional frames round, and missing measurements mean no lift', () => {
  assert.equal(keyboardLift({ containerBottom: 844.33, keyboardTop: 508.67 }), 336)
  assert.equal(keyboardLift({ containerBottom: NaN, keyboardTop: 451 }), 0)
  assert.equal(keyboardLift({ containerBottom: 667, keyboardTop: undefined }), 0)
})

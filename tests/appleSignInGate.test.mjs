import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { APPLE_SIGN_IN_ENABLED } from '../src/features/auth/lib/oauthOptions.js'

// AUDIT-001: the Apple provider is off in Supabase (GET /auth/v1/settings,
// 2026-11-13), so "Continue with Apple" failed on every platform; on the web it
// ended on Supabase's raw JSON 400. The button stays hidden until the owner
// turns the provider on and flips this switch.

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('Apple sign-in is switched off while the provider is off', () => {
  assert.equal(APPLE_SIGN_IN_ENABLED, false)
})

test('both apps show the Apple button only behind the switch', () => {
  for (const file of ['app/(tabs)/profile.tsx', 'src/features/auth/pages/Profile.jsx']) {
    const src = read(file)
    const at = src.indexOf("handleProvider('apple'")
    assert.ok(at > 0, `${file}: Apple button present`)
    const before = src.slice(Math.max(0, at - 400), at)
    assert.match(before, /\{APPLE_SIGN_IN_ENABLED && \(/, `${file}: Apple button gated`)
    assert.match(src, /import \{[^}]*APPLE_SIGN_IN_ENABLED[^}]*\} from '[^']*oauthOptions/, `${file}: imports the switch`)
  }
})

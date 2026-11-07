import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { oauthQueryParams } from '../src/features/auth/lib/oauthOptions.js'

// "Continue with Google" shows Google's account chooser every time, and only
// that: never the consent screen, never offline access.

test('Google asks which account, and nothing more', () => {
  assert.deepEqual(oauthQueryParams('google'), { prompt: 'select_account' })
})

test('other providers get no extra parameters', () => {
  for (const p of ['apple', 'linkedin_oidc', 'azure', '']) assert.equal(oauthQueryParams(p), undefined, p)
})

test('every Google sign-in call in both apps passes these parameters', () => {
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const files = { 'contexts/auth-context.tsx': 2, 'src/features/auth/AuthContext.jsx': 1 }
  for (const [file, calls] of Object.entries(files)) {
    const src = read(file)
    assert.equal((src.match(/signInWithOAuth\(/g) || []).length, calls, `${file}: signInWithOAuth calls`)
    assert.equal((src.match(/queryParams: oauthQueryParams\(provider\)/g) || []).length, calls, `${file}: queryParams`)
    assert.doesNotMatch(src, /prompt:\s*['"]consent['"]|access_type\s*:/, `${file}: no consent or offline access`)
  }
})

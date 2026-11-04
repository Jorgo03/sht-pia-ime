// Password reset hygiene (AUDIT.md Pass 36). Supabase makes reset links and
// codes single-use and expires them after "Email OTP Expiration" (set to 900 s,
// 15 minutes, in the dashboard). The apps' part: setting the new password ends
// every other session, and the "resetting" state does not outlive the tab.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

test('a new password from a reset ends every other session, in both apps', () => {
  for (const f of ['src/features/auth/AuthContext.jsx', 'contexts/auth-context.tsx']) {
    const src = read(f)
    const body = src.slice(src.indexOf('const updatePassword = async'), src.indexOf('const changePassword ='))
    assert.match(body, /updateUser\(\{ password: newPassword \}\)/, f)
    assert.match(body, /signOutOtherDevices\(supabase\)/, `${f} signs out other devices`)
  }
})

test('the website forgets it is mid-reset when the tab closes or the reset ends', () => {
  const src = read('src/features/auth/AuthContext.jsx')
  assert.match(src, /sessionStorage\.setItem\(RECOVERY_FLAG/)
  assert.doesNotMatch(src, /localStorage\.setItem\(RECOVERY_FLAG/)
  const update = src.slice(src.indexOf('const updatePassword = async'), src.indexOf('const changePassword ='))
  assert.match(update, /rememberRecovery\(false\)/)
  const signOut = src.slice(src.indexOf('const signOut = async'), src.indexOf('const value = {'))
  assert.match(signOut, /rememberRecovery\(false\)/)
})

test('the reset code is checked by Supabase, never by the app', () => {
  const app = read('contexts/auth-context.tsx')
  assert.match(app, /verifyOtp\(\{ email, token, type: 'recovery' \}\)/)
})

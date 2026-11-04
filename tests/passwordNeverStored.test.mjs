// Passwords exist only inside Supabase Auth, which stores them as bcrypt
// hashes. No app code may write one to device storage, a log, or a table:
// this fails when a line hands a password-named value to any of those.
// Checked 2026-11-04 against the live project too (AUDIT.md Pass 30).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['app', 'components', 'contexts', 'hooks', 'lib', 'src', 'supabase/functions']
const EXT = /\.(ts|tsx|js|jsx|mjs)$/
// A sink and a password-named value in one statement. supabase.auth.* calls
// (signInWithPassword, signUp, updateUser) are where a password belongs.
const SINK = /(AsyncStorage|localStorage|sessionStorage|SecureStore|setItem\(|console\.(log|info|warn|error|debug)|\bdebug\(|\.(insert|upsert)\(|\.from\([^)]*\)\.update\()/
const PASSWORD = /\b\w*(password|passwd)\w*\b/i

export function offendingLines(source) {
  return source
    .split(/;|\n/)
    .map((s) => s.trim())
    .filter((s) => SINK.test(s) && PASSWORD.test(s) && !/auth\./.test(s) && !/^(\/\/|\*)/.test(s))
}

function files(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'locales' ? [] : files(p)
    return EXT.test(e.name) ? [p] : []
  })
}

test('the guard catches a password written to storage, a log or a table', () => {
  assert.equal(offendingLines("AsyncStorage.setItem('pw', password)").length, 1)
  assert.equal(offendingLines('console.log(newPassword)').length, 1)
  assert.equal(offendingLines("supabase.from('profiles').insert({ password })").length, 1)
  assert.equal(offendingLines('await supabase.auth.updateUser({ password: newPassword })').length, 0)
  assert.equal(offendingLines("setItem('fho_theme_v2', theme)").length, 0)
})

test('no app code stores, logs or inserts a password', () => {
  const found = ROOTS.flatMap(files).flatMap((f) =>
    offendingLines(fs.readFileSync(f, 'utf8')).map((line) => `${f}: ${line}`),
  )
  assert.deepEqual(found, [])
})

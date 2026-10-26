import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// F4: the auth emails. Both apps confirm sign-up, email sign-in and phone
// password recovery with a typed 6-digit code (verifyOtp), so a template
// without {{ .Token }} would strand every new user. The website's recovery
// uses the link, so recovery needs both.
const read = (name) => readFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), 'utf8')
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')

for (const name of ['confirmation', 'recovery', 'magic_link', 'email_change']) {
  test(`${name}: carries the code and the link, in Albanian and English`, () => {
    const html = read(name)
    assert.match(html, /\{\{ \.Token \}\}/)
    assert.match(html, /href="\{\{ \.ConfirmationURL \}\}"/)
    assert.match(html, /<html lang="sq">/)
    assert.match(html, /lang="en"/)
    // No tracking pixels or external assets: nothing loads from elsewhere.
    assert.doesNotMatch(html, /<img|src=|url\(/i)
  })

  test(`${name}: wired into supabase/config.toml`, () => {
    // \r?\n: a Windows checkout (core.autocrlf) gives config.toml CRLF endings.
    assert.match(config, new RegExp(`\\[auth\\.email\\.template\\.${name}\\]\\r?\\nsubject = "[^"]+"\\r?\\ncontent_path = "\\./supabase/templates/${name}\\.html"`))
  })
}

test('the code length the apps expect matches the config', () => {
  assert.match(config, /otp_length = 6/)
})

test('the expiry the emails state matches the configured one, not a guess', () => {
  const seconds = Number(/\[auth\.email\][\s\S]*?otp_expiry = (\d+)/.exec(config)[1])
  assert.equal(seconds, 3600, 'the templates say 1 hour; change them together with otp_expiry')
  for (const name of ['confirmation', 'magic_link', 'recovery']) {
    const html = readFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), 'utf8')
    assert.match(html, /1 ore/, `${name}: Albanian expiry`)
    assert.match(html, /1 hour/, `${name}: English expiry`)
  }
})

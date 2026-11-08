import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CODE_TTL_S } from '../src/features/auth/lib/signupCode.js'

// F4: the auth emails. Both apps confirm sign-up, email sign-in and phone
// password recovery with a typed 6-digit code (verifyOtp), so a template
// without {{ .Token }} would strand every new user. The link goes to the
// website's /auth/confirm with a token_hash, which works on any device and
// only verifies when the person presses the button (mail scanners that open
// links cannot use the token up).
const read = (name) => readFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), 'utf8')
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')

for (const name of ['confirmation', 'recovery', 'magic_link', 'email_change']) {
  test(`${name}: carries the code and the link, in Albanian and English`, () => {
    const html = read(name)
    assert.match(html, /\{\{ \.Token \}\}/)
    const type = { confirmation: 'email', recovery: 'recovery', magic_link: 'email', email_change: 'email_change' }[name]
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    // The sign-in email is a code to type: nothing to click.
    if (name === 'magic_link') assert.equal(hrefs.length, 0)
    else assert.ok(hrefs.length > 0)
    for (const href of hrefs) {
      assert.equal(href, `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}`)
    }
    // No link that lands where the browser that asked must be the one that opens it.
    assert.doesNotMatch(html, /ConfirmationURL|RedirectTo/)
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

test('the expiry the emails state matches the configured one and the countdown in the apps', () => {
  const seconds = Number(/\[auth\.email\][\s\S]*?otp_expiry = (\d+)/.exec(config)[1])
  assert.equal(seconds, CODE_TTL_S, 'signupCode.js CODE_TTL_S, otp_expiry and the templates change together')
  assert.equal(seconds, 600, 'the templates say 10 minutes')
  for (const name of ['confirmation', 'magic_link', 'recovery']) {
    const html = readFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), 'utf8')
    assert.match(html, /10 minutash/, `${name}: Albanian expiry`)
    assert.match(html, /10 minutes/, `${name}: English expiry`)
    assert.doesNotMatch(html, /1 ore|1 hour/, `${name}: no stale expiry`)
  }
})

test('the sign-up email: app name, logo, the code, its expiry and a do-not-share warning', () => {
  const html = read('confirmation')
  assert.match(html, /Shtëpia<span[^>]*>\.ime<\/span>/)
  assert.match(html, /background:#e85d00[^"]*">S<\/td>/, 'the logo mark, drawn without an image')
  assert.match(html, /Your verification code is:/)
  assert.match(html, /Kodi yt i verifikimit është:/)
  assert.match(html, /Do not share this code/)
  assert.match(html, /Mos ia trego këtë kod askujt/)
  assert.match(config, /\[auth\.email\][\s\S]*?enable_confirmations = true/)
})

test('the sign-in email: title, the code, expiry, a do-not-share warning and no technical detail', () => {
  const html = read('magic_link')
  assert.match(html, /Your Login Verification Code/)
  assert.match(html, /Kodi yt i verifikimit është:/)
  assert.match(html, /This code expires in 10 minutes\./)
  assert.match(html, /Do not share this code/)
  assert.match(html, /Mos ia trego këtë kod askujt/)
  assert.match(html, /you can safely ignore this email/)
  assert.doesNotMatch(html, /TokenHash|SiteURL/)
})

test('password_changed: a security notice with no link to follow, wired into config.toml', () => {
  const html = read('password_changed_notification')
  assert.match(html, /<html lang="sq">/)
  assert.match(html, /lang="en"/)
  // A notice, not an action: phishing copies of it would need a link, so it has none.
  assert.doesNotMatch(html, /<a |href=|<img|src=|url\(/i)
  assert.match(config, /\[auth\.email\.notification\.password_changed\]\r?\nenabled = true\r?\nsubject = "[^"]+"\r?\ncontent_path = "\.\/supabase\/templates\/password_changed_notification\.html"/)
})

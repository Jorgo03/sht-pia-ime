import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Both websites (the Vite site, and the one built from the Expo app) send the
// basic security headers on every page. Without them another site could load
// the sign-in or password pages inside a hidden frame (clickjacking); Vercel
// itself only adds HSTS. Checked live 2026-10-27: HSTS was the only one.
const REQUIRED = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

for (const file of ['vercel.json', 'deploy/expo-web/vercel.json']) {
  test(`${file}: security headers on every path`, () => {
    const config = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
    const all = config.headers.find((h) => h.source === '/(.*)')
    assert.ok(all, 'a rule for every path')
    const sent = Object.fromEntries(all.headers.map((h) => [h.key, h.value]))
    assert.deepEqual(sent, REQUIRED)
  })
}

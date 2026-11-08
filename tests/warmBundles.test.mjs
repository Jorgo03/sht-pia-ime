import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { bundleOptions, bundlePath } = require('../scripts/warm-bundles.cjs')

// A phone that asks while Metro builds from an empty cache gives up with
// "Could not connect to development server" (a 7 minute build on 2026-11-08).
// So the start scripts build first, and test runs keep to their own cache.

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('the warm-up asks for exactly what Expo Go asks for', () => {
  // Copied from the phone's own error message.
  assert.equal(
    bundlePath('ios'),
    '/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable',
  )
  assert.match(bundlePath('android'), /platform=android&/)
})

test('the fast start warms the production bundle', () => {
  assert.deepEqual(bundleOptions([]), { dev: true, minify: false })
  assert.deepEqual(bundleOptions(['--no-dev', '--minify']), { dev: false, minify: true })
  assert.match(bundlePath('ios', { dev: false, minify: true }), /dev=false.*minify=true/)
})

test('both start scripts build before drawing the QR code', () => {
  for (const [file, opening] of [
    ['scripts/expo-go-qr.cjs', 'Dev server is up'],
    ['scripts/expo-tunnel-qr.cjs', 'Tunnel is live and serving'],
  ]) {
    const src = read(file)
    const warm = src.indexOf('await warmBundles(')
    assert.ok(warm > -1, file)
    assert.ok(warm < src.indexOf(opening), `${file}: warms before the QR`)
  }
})

test('the e2e build, which clears its cache, does not share the phone cache', () => {
  const config = read('playwright.expo.config.ts')
  assert.match(config, /--clear/)
  for (const v of ['TEMP', 'TMP', 'TMPDIR']) assert.match(config, new RegExp(`\\b${v}: E2E_TEMP`))
})

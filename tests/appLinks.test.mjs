import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

// AUDIT-008: a shared listing link (https://<domain>/property/<id>) always
// opened the website, never the app: no iOS associated domains, no Android
// verified app links. Everything is ready in code; it switches on when the
// owner sets APP_LINK_DOMAIN and writes the two .well-known files.

const require = createRequire(import.meta.url)
const { buildAasa, buildAssetLinks } = require('../scripts/write-app-links.cjs')

function loadAppConfig() {
  const module = { exports: {} }
  vm.runInThisContext(`(function (module, exports, process, require) {${readFileSync(new URL('../app.config.js', import.meta.url), 'utf8')}\n})`)(module, module.exports, process, require)
  return module.exports
}
const makeConfig = loadAppConfig()
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo

function withEnv(env, fn) {
  const before = {}
  for (const k of Object.keys(env)) { before[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k] }
  try { return fn() } finally {
    for (const k of Object.keys(env)) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k] }
  }
}

test('no domain: no app links (nothing to verify against yet)', () => {
  const out = withEnv({ APP_LINK_DOMAIN: undefined, SIDELOAD_FREE: undefined }, () => makeConfig({ config: appJson }))
  assert.equal(out.ios.associatedDomains, undefined)
  assert.equal(out.android.intentFilters, undefined)
})

test('with a domain: iOS associated domains and Android verified links for listings and profiles', () => {
  const out = withEnv({ APP_LINK_DOMAIN: 'shtepia.al', SIDELOAD_FREE: undefined }, () => makeConfig({ config: appJson }))
  assert.deepEqual(out.ios.associatedDomains, ['applinks:shtepia.al', 'applinks:www.shtepia.al'])
  const [filter] = out.android.intentFilters
  assert.equal(filter.autoVerify, true)
  assert.equal(filter.action, 'VIEW')
  const prefixes = filter.data.map((d) => `${d.scheme}://${d.host}${d.pathPrefix}`)
  for (const p of ['/property', '/user', '/agent']) {
    assert.ok(prefixes.includes(`https://shtepia.al${p}`), p)
    assert.ok(prefixes.includes(`https://www.shtepia.al${p}`), p)
  }
})

test('a scheme or path in the variable is refused, not half-applied', () => {
  assert.throws(() => withEnv({ APP_LINK_DOMAIN: 'https://shtepia.al/x', SIDELOAD_FREE: undefined }, () => makeConfig({ config: appJson })), /APP_LINK_DOMAIN/)
})

test('free sideload builds drop associated domains (a paid Apple account is needed for them)', () => {
  const out = withEnv({ APP_LINK_DOMAIN: 'shtepia.al', SIDELOAD_FREE: '1' }, () => makeConfig({ config: appJson }))
  assert.equal(out.ios.associatedDomains, undefined)
})

test('the .well-known files: Apple app-site-association and Android asset links', () => {
  const aasa = buildAasa('ABCDE12345', 'com.shtepiaime.app')
  assert.deepEqual(aasa.applinks.details[0].appIDs, ['ABCDE12345.com.shtepiaime.app'])
  assert.deepEqual(aasa.applinks.details[0].components.map((c) => c['/']), ['/property/*', '/user/*', '/agent/*'])
  assert.throws(() => buildAasa('nope', 'com.shtepiaime.app'), /Team ID/)
  const fp = Array.from({ length: 32 }, () => 'AB').join(':')
  const links = buildAssetLinks('com.shtepiaime.app', [fp])
  assert.equal(links[0].target.package_name, 'com.shtepiaime.app')
  assert.deepEqual(links[0].target.sha256_cert_fingerprints, [fp])
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls'])
  assert.throws(() => buildAssetLinks('com.shtepiaime.app', ['12:34']), /fingerprint/)
})

test('Vercel serves the Apple file as JSON', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const h = vercel.headers.find((x) => x.source === '/.well-known/apple-app-site-association')
  assert.ok(h, 'header rule')
  assert.deepEqual(h.headers, [{ key: 'Content-Type', value: 'application/json' }])
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// app.config.js (F9): the Android Google Maps key comes only from the
// environment, and nothing else in app.json changes because of it.
// Expo loads app.config.js as CommonJS through its own loader, while this
// package is "type": "module", so the test evaluates it the same way.
function loadAppConfig() {
  const module = { exports: {} }
  vm.runInThisContext(`(function (module, exports, process) {${readFileSync(new URL('../app.config.js', import.meta.url), 'utf8')}\n})`)(module, module.exports, process)
  return module.exports
}
const makeConfig = loadAppConfig()
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo

function withEnv(value, fn) {
  const before = process.env.GOOGLE_MAPS_ANDROID_API_KEY
  if (value === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY
  else process.env.GOOGLE_MAPS_ANDROID_API_KEY = value
  try { return fn() } finally {
    if (before === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = before
  }
}

test('no key in the environment: the config is app.json unchanged', () => {
  const out = withEnv(undefined, () => makeConfig({ config: appJson }))
  assert.equal(out.android.config, undefined)
  assert.deepEqual(out, appJson)
  assert.equal(withEnv('   ', () => makeConfig({ config: appJson })).android.config, undefined)
})

test('a key in the environment goes to android.config.googleMaps.apiKey only', () => {
  const out = withEnv(' test-key ', () => makeConfig({ config: appJson }))
  assert.equal(out.android.config.googleMaps.apiKey, 'test-key')
  assert.equal(out.android.package, appJson.android.package)
  assert.deepEqual(out.ios, appJson.ios)
  assert.equal(out.android.adaptiveIcon, appJson.android.adaptiveIcon)
})

test('the committed app.json carries no maps key', () => {
  assert.equal(appJson.android.config?.googleMaps?.apiKey, undefined)
  assert.doesNotMatch(readFileSync(new URL('../app.json', import.meta.url), 'utf8'), /AIza[0-9A-Za-z_-]{20,}/)
})

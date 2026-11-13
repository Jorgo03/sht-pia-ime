import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// AUDIT-031: the iPhone's permission prompts (photos, location) existed only
// in English, though the app is Albanian-first. Expo writes these locale files
// into InfoPlist.strings per language at build time (app.json "locales").

const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo
const KEYS = ['CFBundleDisplayName', 'NSPhotoLibraryUsageDescription', 'NSLocationWhenInUseUsageDescription']

test('app.json declares Albanian and English locale files for iOS', () => {
  assert.deepEqual(Object.keys(app.locales ?? {}).sort(), ['en', 'sq'])
  assert.equal(app.ios.infoPlist.CFBundleAllowMixedLocalizations, true)
})

test('each locale file has every prompt, and the English ones match the plugin texts', () => {
  const plugin = (name) => app.plugins.find((p) => Array.isArray(p) && p[0] === name)[1]
  for (const lang of ['sq', 'en']) {
    const file = JSON.parse(fs.readFileSync(app.locales[lang], 'utf8'))
    for (const k of KEYS) assert.ok(file.ios[k]?.length > 5, `${lang}: ${k}`)
  }
  const en = JSON.parse(fs.readFileSync(app.locales.en, 'utf8')).ios
  assert.equal(en.NSPhotoLibraryUsageDescription, plugin('expo-image-picker').photosPermission)
  assert.equal(en.NSLocationWhenInUseUsageDescription, plugin('expo-location').locationWhenInUsePermission)
  const sq = JSON.parse(fs.readFileSync(app.locales.sq, 'utf8')).ios
  assert.match(sq.NSPhotoLibraryUsageDescription, /fotot/)
  assert.match(sq.NSLocationWhenInUseUsageDescription, /vendndodhjen/)
})

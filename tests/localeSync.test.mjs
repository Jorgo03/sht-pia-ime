// Confirms all 8 shared locale files (used by both the web and mobile apps —
// see CLAUDE.md's i18n rule: "a key added on one platform's code path needs
// the underlying locale JSON key to exist for both, since the files are
// shared") stay in sync with each other. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales')
const LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flattenKeys(v, path))
    else keys.push(path)
  }
  return keys
}

const locales = Object.fromEntries(
  LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'))]),
)

test('every locale file is valid JSON with a non-empty top level', () => {
  for (const lang of LANGS) {
    assert.ok(locales[lang] && typeof locales[lang] === 'object')
    assert.ok(Object.keys(locales[lang]).length > 0, `${lang}.json is empty`)
  }
})

// Repo-wide keyset parity lives in localePlurals.test.mjs, which compares on
// suffix-stripped base keys — plural categories legitimately differ per
// language (pl carries _few, en does not), so a naive identical-keyset check
// would fail by design.
test('the new password-recovery keys exist in every locale', () => {
  const required = ['auth.recoveryTitle', 'auth.recoverySubtitle', 'auth.newPassword', 'auth.updatePassword', 'auth.recoverySuccess']
  for (const lang of LANGS) {
    const keys = new Set(flattenKeys(locales[lang]))
    for (const key of required) {
      assert.ok(keys.has(key), `${lang}.json is missing ${key}`)
    }
  }
})

test('errors.passwordRequired (the new login-only empty-password message) exists in every locale', () => {
  for (const lang of LANGS) {
    const keys = new Set(flattenKeys(locales[lang]))
    assert.ok(keys.has('errors.passwordRequired'), `${lang}.json is missing errors.passwordRequired`)
  }
})

test('none of the auth/errors keys touched by this change are empty strings', () => {
  for (const lang of LANGS) {
    for (const section of ['auth', 'errors']) {
      const value = locales[lang][section]
      assert.ok(value && typeof value === 'object', `${lang}.json is missing the "${section}" section`)
      for (const [key, v] of Object.entries(value)) {
        if (typeof v === 'string') assert.notEqual(v.trim(), '', `${lang}.json: "${section}.${key}" is an empty string`)
      }
    }
  }
})

test('no locale string is empty anywhere', () => {
  // An empty value is not a harmless no-op: these files feed two-part
  // headlines rendered as `{pre} <em>{em}</em>`, and React Native (unlike
  // HTML) does not collapse the literal space between them — sq's empty
  // favourites.headlinePre shipped a stray leading space on mobile.
  const empties = []
  for (const lang of LANGS) {
    for (const [key, value] of flattenKeys(locales[lang]).map((k) => [k, k.split('.').reduce((o, p) => o?.[p], locales[lang])])) {
      if (typeof value === 'string' && value.trim() === '') empties.push(`${lang}.json: "${key}"`)
    }
  }
  assert.deepEqual(empties, [], `\n${empties.join('\n')}\n`)
})

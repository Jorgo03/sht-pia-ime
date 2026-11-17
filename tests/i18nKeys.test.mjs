// Catches t('...') keys that are used in source but absent from the shared
// locale files. i18next has no runtime safety net for this: a key it cannot
// resolve is rendered as its own literal path, so the UI ships the string
// "listing.priceLabel" where a price label belongs. Run with: npm test
//
// Two of these were live simultaneously in app/property/[id].tsx:
//   • t('listing.priceLabel') — never existed in any of the 8 locales, so
//     every mobile property detail page printed "listing.priceLabel".
//   • t('auth.signIn') — the auth namespace carries signInTitle / signInWith /
//     signInWithEmail but no bare signIn, so the sign-in Alert button read
//     "auth.signIn". A near-miss key name is the common shape of this bug.
//
// Neither the type checker nor the linter can see it: t() is typed as
// (string) => string. CLAUDE.md's i18n rule ("zero hardcoded UI strings,
// everything through t('...')") and brief §6.4 ("no untranslated keys leak
// into the UI as raw paths") are only enforceable from here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LOCALES_DIR = join(ROOT, 'src', 'i18n', 'locales')

// Both apps read the same files (src/i18n/index.js and i18n/index.ts import
// them), both under the default `translation` namespace, so a key path in
// source maps straight onto a path in these JSON documents. en is the
// reference language; sq is what every locale falls back to at runtime
// (fallbackLng: 'sq'), so a key missing from sq has no rescue path at all.
const CHECKED_LANGS = ['en', 'sq']

// Web's Vite tree plus the Expo tree. dist/ and node_modules/ sit outside all
// of these, but SKIP_DIRS is still enforced during the walk: an early version
// of this check scanned from the repo root and reported minified build output
// in dist/ as missing keys (`beds`, `city`, `minPrice`…), which is noise that
// hides the real findings.
const SOURCE_ROOTS = ['src', 'app', 'components', 'hooks', 'contexts']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.expo', 'android', 'ios'])
const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx']

// i18next resolves a pluralised key through its suffixed siblings; the bare
// key deliberately does not exist for those (see localePlurals.test.mjs).
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other']

const locales = Object.fromEntries(
  CHECKED_LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'))]),
)

function lookup(obj, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), obj)
}

/** 'string' | 'plural' | 'object' | 'missing' — how i18next would resolve key.
 *  'object' is a branch node (t('listing.type') when only listing.type.rent
 *  exists): i18next returns the key path for it exactly as it does for a
 *  missing key, so it is a UI bug of the same shape, not a near-miss. */
function resolution(locale, key) {
  const direct = lookup(locale, key)
  if (typeof direct === 'string') return 'string'
  if (PLURAL_SUFFIXES.some((suffix) => typeof lookup(locale, key + suffix) === 'string')) return 'plural'
  return direct === undefined ? 'missing' : 'object'
}

function sourceFiles() {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) files.push(full)
    }
  }
  for (const root of SOURCE_ROOTS) walk(join(ROOT, root))
  return files
}

/** Pulls every t('literal') / i18n.t('literal') call out of one file.
 *
 *  Hand-scanned rather than regex-matched because the two things that have to
 *  be read precisely both sit *after* the key: whether the literal is a
 *  template with an interpolation in it, and whether the second argument is a
 *  hardcoded default string. A regex that stops at the first quote-ish
 *  character reports `t(`listing.step.${s}`)` as a missing key named
 *  "listing.step." — a phantom finding for a call that is fine. */
function scanCalls(src, file) {
  const calls = []
  // \b keeps this off format(, at(, useT( etc.; the lookbehind keeps a bare
  // t( from also matching some other object's .t(), while i18n.t( — used by
  // the class error boundaries, which have no useTranslation() hook — is
  // matched explicitly.
  const CALL_START = /(?:\bi18n\.t|(?<![\w.$])t)\s*\(/g
  let match
  while ((match = CALL_START.exec(src)) !== null) {
    let i = match.index + match[0].length
    while (i < src.length && /\s/.test(src[i])) i++

    const quote = src[i]
    // t(variableKey) — nothing static to verify. src/shared/ErrorBoundary.jsx
    // wraps i18n.t this way.
    if (quote !== "'" && quote !== '"' && quote !== '`') continue

    let key = ''
    let dynamic = false
    let braces = 0
    let j = i + 1
    for (; j < src.length; j++) {
      const ch = src[j]
      if (braces > 0) {
        if (ch === '{') braces++
        else if (ch === '}') braces--
        continue
      }
      if (ch === '\\') {
        key += src[j + 1] ?? ''
        j++
        continue
      }
      if (quote === '`' && ch === '$' && src[j + 1] === '{') {
        dynamic = true
        braces = 1
        j++
        continue
      }
      if (ch === quote) break
      if (ch === '\n' && quote !== '`') break // mis-parse; treat as unreadable
      key += ch
    }
    if (src[j] !== quote) continue

    const line = src.slice(0, match.index).split('\n').length

    let k = j + 1
    while (k < src.length && /\s/.test(src[k])) k++
    // A literal that is only the head of a larger expression is a runtime key
    // too: app/listing/new.tsx builds one by concatenation, t('listing.step.'
    // + STEPS[step]), which reads as a static "listing.step." key unless the
    // character after the closing quote is checked.
    const concatenated = src[k] !== ',' && src[k] !== ')'

    // t(`listing.step.${s}`) and friends build their key at runtime. The
    // segments they interpolate are DB enum values, so the only honest check
    // would be against the enum, not against source text — out of scope here.
    if (dynamic || concatenated || key === '') {
      calls.push({ file, line, key, dynamic: true, inlineDefault: null })
      continue
    }

    // Second argument: a string literal is i18next's inline default value,
    // an object is options ({ count }, interpolation values, …).
    let inlineDefault = null
    if (src[k] === ',') {
      k++
      while (k < src.length && /\s/.test(src[k])) k++
      if (src[k] === "'" || src[k] === '"' || src[k] === '`') {
        const end = src.indexOf(src[k], k + 1)
        inlineDefault = end === -1 ? '' : src.slice(k + 1, end)
      }
    }
    calls.push({ file, line, key, dynamic: false, inlineDefault })
  }
  return calls
}

const files = sourceFiles()
const calls = files.flatMap((full) => scanCalls(readFileSync(full, 'utf8'), relative(ROOT, full).split(sep).join('/')))
const staticCalls = calls.filter((c) => !c.dynamic)
// A call carrying an inline default renders that default, not the key path,
// so it cannot produce the bug this file is named for. It is still a rule
// violation — reported, without failing, by the last test.
const bareCalls = staticCalls.filter((c) => c.inlineDefault === null)
const site = (c) => `${c.file}:${c.line} → t('${c.key}')`

test('every source root the check claims to cover actually exists', () => {
  // A renamed or moved directory would otherwise turn this whole file into a
  // silent no-op that keeps reporting success.
  const missing = SOURCE_ROOTS.filter((root) => !existsSync(join(ROOT, root)))
  assert.deepEqual(missing, [], `SOURCE_ROOTS points at directories that are gone: ${missing.join(', ')}`)
})

test('the scan found source files and t() calls (guards against a vacuous suite)', () => {
  assert.ok(files.length > 50, `only ${files.length} source files scanned — the walk is probably broken`)
  assert.ok(staticCalls.length > 100, `only ${staticCalls.length} static t() calls found — the scanner is probably broken`)
})

test('no build output or vendored code is scanned', () => {
  const leaked = files.filter((full) => relative(ROOT, full).split(sep).some((segment) => SKIP_DIRS.has(segment)))
  assert.deepEqual(leaked, [], `\n${leaked.join('\n')}\n`)
})

for (const lang of CHECKED_LANGS) {
  test(`every t() key used in source resolves in ${lang}.json`, () => {
    const failures = bareCalls
      .filter((c) => resolution(locales[lang], c.key) === 'missing')
      .map((c) => `  ${site(c)}`)
    assert.deepEqual(
      failures,
      [],
      `\n${failures.length} key(s) used in source but absent from ${lang}.json — i18next renders these as their own literal path:\n${failures.join('\n')}\n\nAdd the key to all 8 files in src/i18n/locales/ (they are shared by web and mobile).\n`,
    )
  })

  test(`no t() key resolves to a branch node instead of a string in ${lang}.json`, () => {
    const failures = bareCalls
      .filter((c) => resolution(locales[lang], c.key) === 'object')
      .map((c) => `  ${site(c)} — ${lang}.json has this as a group of keys, not a string`)
    assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`)
  })
}

test('t() calls with a hardcoded inline default are reported, and limited to the known set', (t) => {
  // t('key', 'Some English') is not the raw-key bug — it renders readable
  // text in place of the key — but it is a hardcoded UI string, which
  // CLAUDE.md forbids, and it masks the missing key from every reader of the
  // diff and from the checks above. Non-fatal by design, so listing them is
  // the whole point: each one is reported as a diagnostic, and the assertion
  // only catches sites added after this baseline. The four grandfathered ones
  // are .web.tsx shims standing in for native-only components.
  const ALLOWED = new Set([
    'components/listing/location-picker.web.tsx::listing.latitude',
    'components/listing/location-picker.web.tsx::listing.longitude',
    'components/map/map-canvas.web.tsx::map.webUnavailableTitle',
    'components/map/map-canvas.web.tsx::map.webUnavailableHint',
  ])
  const found = staticCalls.filter((c) => c.inlineDefault !== null)

  for (const c of found) {
    const unresolved = CHECKED_LANGS.filter((lang) => resolution(locales[lang], c.key) !== 'string')
    const note = unresolved.length ? ` — key absent from ${unresolved.map((l) => `${l}.json`).join(', ')}` : ''
    t.diagnostic(`inline default: ${site(c)} → "${c.inlineDefault.slice(0, 60)}"${note}`)
  }

  const unexpected = found
    .filter((c) => !ALLOWED.has(`${c.file}::${c.key}`))
    .map((c) => `  ${site(c)} defaulting to "${c.inlineDefault.slice(0, 60)}"`)
  assert.deepEqual(
    unexpected,
    [],
    `\nHardcoded English defaults — put the text in all 8 src/i18n/locales/*.json and drop the second argument:\n${unexpected.join('\n')}\n`,
  )
})

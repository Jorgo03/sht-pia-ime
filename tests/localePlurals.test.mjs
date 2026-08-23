// Guards i18next pluralisation across the 8 shared locale files (both apps
// import these — see CLAUDE.md's i18n rule). Run with: npm test
//
// This exists because a whole class of bug shipped undetected: keys that
// interpolate {{count}} but carry no plural variants. i18next then falls back
// to the base key, so English rendered "1 new matches today." / "1 homes",
// and — worse — Polish and Russian, which legitimately need `few`/`many`,
// fell through `fallbackLng: 'sq'` and rendered Albanian ("5 prona") to
// Slavic users. Both were live in production.
//
// The required suffix list is read from i18next's own pluralResolver rather
// than hardcoded, so it stays correct if CLDR categories change under us
// (Spanish and Italian gained `many` in CLDR 42, for example).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import i18next from 'i18next'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LOCALES_DIR = join(ROOT, 'src', 'i18n', 'locales')
const LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/

const locales = Object.fromEntries(
  LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'))]),
)

function flatten(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, path))
    else out.push([path, v])
  }
  return out
}

const flat = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flatten(locales[l]))]))

// i18next is the authority on which categories each language needs.
await i18next.init({ resources: {}, supportedLngs: LANGS, lng: 'en' })
const requiredSuffixes = Object.fromEntries(
  LANGS.map((l) => [l, i18next.services.pluralResolver.getSuffixes(l).map((s) => s.replace(/^_/, ''))]),
)

/** Base keys that are pluralised: either they interpolate {{count}}, or some
 *  locale already carries a plural variant of them. The second case matters —
 *  `search.homesInView` is a bare noun phrase ("homes in view") rendered
 *  beside a separately-styled bold number, so it never contains {{count}}
 *  even though i18next still picks its category from the count option. */
const countKeys = new Set()
for (const l of LANGS) {
  for (const [key, value] of Object.entries(flat[l])) {
    if (typeof value === 'string' && value.includes('{{count}}')) {
      countKeys.add(key.replace(PLURAL_SUFFIX_RE, ''))
    }
    if (PLURAL_SUFFIX_RE.test(key)) {
      countKeys.add(key.replace(PLURAL_SUFFIX_RE, ''))
    }
  }
}

test('there is at least one {{count}} key to check (guards against a silently vacuous suite)', () => {
  assert.ok(countKeys.size > 0, 'no {{count}} keys found — the extraction above is probably broken')
})

test('every {{count}} key has all plural categories its language requires', () => {
  const failures = []
  for (const base of countKeys) {
    for (const l of LANGS) {
      // A key may legitimately not exist in a locale at all — that is the
      // separate parity test's job. Only check locales that carry it.
      const present = requiredSuffixes[l].filter((s) => `${base}_${s}` in flat[l])
      const hasBare = base in flat[l]
      if (!hasBare && present.length === 0) continue
      const missing = requiredSuffixes[l].filter((s) => !(`${base}_${s}` in flat[l]))
      if (missing.length) {
        failures.push(`${l}.json: "${base}" missing ${missing.map((s) => `_${s}`).join(', ')}`)
      }
      if (hasBare) {
        failures.push(`${l}.json: "${base}" still has a non-plural base key alongside {{count}}`)
      }
    }
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`)
})

test('no {{count}} key silently falls back to another language at runtime', async () => {
  const resources = Object.fromEntries(LANGS.map((l) => [l, { translation: locales[l] }]))
  const i18n = i18next.createInstance()
  await i18n.init({ resources, fallbackLng: 'sq', supportedLngs: LANGS, interpolation: { escapeValue: false } })

  const failures = []
  for (const base of countKeys) {
    for (const l of LANGS) {
      if (l === 'sq') continue
      if (!requiredSuffixes[l].some((s) => `${base}_${s}` in flat[l])) continue
      await i18n.changeLanguage(l)
      // 1, 2 and 5 land in different CLDR categories for the Slavic locales,
      // which is exactly where the Albanian fallback used to surface.
      for (const count of [1, 2, 5]) {
        const rendered = i18n.t(base, { count, unread: 0 })
        const albanian = Object.values(
          Object.fromEntries(
            requiredSuffixes.sq.map((s) => [s, flat.sq[`${base}_${s}`]]).filter(([, v]) => v !== undefined),
          ),
        )
        const leaked = albanian.some(
          (sqText) => typeof sqText === 'string' && rendered === sqText.replace('{{count}}', String(count)).replace('{{unread}}', '0'),
        )
        if (leaked) failures.push(`${l}: t("${base}", {count: ${count}}) rendered the Albanian string "${rendered}"`)
      }
    }
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`)
})

test('no source file calls t() with an explicit plural suffix', () => {
  // Naming a suffix directly (t('search.results_other', {count})) bypasses
  // plural resolution entirely — it pins one category regardless of count,
  // and Slavic locales never reach few/many. Shipped in the mobile map screen.
  const exts = new Set(['.js', '.jsx', '.ts', '.tsx'])
  const skip = new Set(['node_modules', 'dist', '.git', 'android', 'ios', '.expo', 'build', 'coverage'])
  const offenders = []

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (![...exts].some((e) => entry.name.endsWith(e))) continue
      const src = readFileSync(full, 'utf8')
      const re = /\bt\(\s*['"`]([^'"`]*_(?:zero|one|two|few|many|other))['"`]/g
      let m
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${full.replace(ROOT, '').replace(/^[\\/]/, '')}:${line} → t('${m[1]}')`)
      }
    }
  }
  walk(ROOT)
  assert.deepEqual(offenders, [], `\nCall the base key with {count} instead:\n${offenders.join('\n')}\n`)
})

test('locale files agree on their base keyset once plural suffixes are normalised', () => {
  // Plural categories legitimately differ per language (pl has _few, en does
  // not), so compare on suffix-stripped base keys.
  const baseKeys = Object.fromEntries(
    LANGS.map((l) => [l, new Set(Object.keys(flat[l]).map((k) => k.replace(PLURAL_SUFFIX_RE, '')))]),
  )
  const union = new Set(LANGS.flatMap((l) => [...baseKeys[l]]))
  const failures = []
  for (const l of LANGS) {
    const missing = [...union].filter((k) => !baseKeys[l].has(k))
    if (missing.length) failures.push(`${l}.json missing: ${missing.join(', ')}`)
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`)
})

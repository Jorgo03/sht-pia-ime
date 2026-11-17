// XSS and query-injection guards (AUDIT.md Pass 34).
// - React escapes text by itself; the few hand-built HTML strings (Leaflet
//   marker icons, the SEO pages, emails) must escape what they insert.
// - Supabase filters take values as parameters; the only risk is a filter
//   written as text with typed input inside (.or("...")). Those must use a
//   builder that strips filter syntax, or values the user cannot type.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { escapeHtml } from '../src/lib/escapeHtml.js'
import { leadSearchFilter } from '../src/features/leads/lib/leads.js'
import { priceRangeExpression } from '../src/features/properties/lib/priceRange.js'

const ROOTS = ['app', 'components', 'contexts', 'hooks', 'lib', 'src', 'data', 'supabase/functions', 'scripts/expo-web']
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/

function files(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'locales' ? [] : files(p)
    return EXT.test(e.name) ? [p] : []
  })
}
const all = ROOTS.flatMap(files).map((f) => ({ f: f.replace(/\\/g, '/'), s: fs.readFileSync(f, 'utf8') }))

test('escapeHtml neutralises every character that can open markup', () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert('1')">&`), '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;')
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(42), '42')
})

test('no code turns a string into live HTML or code, apart from the static page shell', () => {
  const SINK = /dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write\(|\beval\(|new Function\(/
  const found = all.filter(({ f, s }) => SINK.test(s) && f !== 'app/+html.tsx').map(({ f }) => f)
  assert.deepEqual(found, [])
  // The page shell injects only its own constants.
  const shell = fs.readFileSync('app/+html.tsx', 'utf8')
  assert.deepEqual([...shell.matchAll(/__html:\s*([A-Za-z_]+)/g)].map((m) => m[1]).sort(), ['BASE_CSS', 'OAUTH_RELAY'])
  assert.ok(/const OAUTH_RELAY = `/.test(shell) && !/OAUTH_RELAY = `[^`]*\$\{/.test(shell), 'OAUTH_RELAY has no interpolation')
})

test('map marker HTML escapes what it inserts', () => {
  const builders = all.filter(({ s }) => /divIcon\(/.test(s)).map(({ f }) => f).sort()
  assert.deepEqual(builders, ['components/map/leaflet/leaflet-maps.tsx', 'src/features/properties/components/MapMarker.jsx'])
  const web = fs.readFileSync('src/features/properties/components/MapMarker.jsx', 'utf8')
  for (const m of web.matchAll(/html:\s*`([^`]*)`/g)) {
    for (const v of m[1].matchAll(/\$\{([^}]*)\}/g)) assert.match(v[1], /^escapeHtml\(/, `escaped: ${v[1]}`)
  }
  const app = fs.readFileSync('components/map/leaflet/leaflet-maps.tsx', 'utf8')
  assert.match(app, /\$\{esc\(label\)\}/)
})

test('text filters only hold the account id, or go through a builder that strips filter syntax', () => {
  const VETTED = new Set([
    'supabase/functions/ai-assistant/logic.js', // keywords pass cleanText(), which strips , ( ) * % _ \ : . " ' and more
    'src/features/profiles/lib/publicProfile.js', // the id must pass isUserId(), a strict UUID, first (tests/publicProfile.test.mjs)
  ])
  const bad = []
  for (const { f, s } of all) {
    for (const m of s.matchAll(/\.or\(\s*`([^`]*)`/g)) {
      const vars = [...m[1].matchAll(/\$\{([^}]*)\}/g)].map((v) => v[1].trim())
      if (vars.some((v) => v !== 'user.id') && !VETTED.has(f)) bad.push(`${f}: ${m[0].slice(0, 60)}`)
    }
  }
  assert.deepEqual(bad, [])
})

test('the lead search cannot add its own filter conditions', () => {
  const or = leadSearchFilter('x),status.eq.won,(name.ilike.*')
  const conditions = or.split(',')
  assert.equal(conditions.length, 3)
  for (const c of conditions) assert.match(c, /^(name|email|notes)\.ilike\.\*[^,()]*\*$/)
})

test('price filters hold numbers only', () => {
  assert.equal(priceRangeExpression('1000),or(id.neq.0', null), null)
  assert.match(priceRangeExpression(1000, 2000), /^[a-z_.(),A-Z0-9 ]+$/)
})

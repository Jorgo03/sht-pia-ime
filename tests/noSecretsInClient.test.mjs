// Secret keys live only on the server, as Supabase Edge Function secrets
// (Deno.env.get in supabase/functions). Anything named EXPO_PUBLIC_* or
// VITE_* is copied into the app and website that every visitor downloads, so
// only the Supabase URL, the anon key (public by design; RLS protects the
// data) and plain settings may have those names. This fails if a secret-named
// variable gets a public prefix, or a real-looking key is written into code.
// Checked 2026-11-04 against both built bundles too (AUDIT.md Pass 31).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

const CLIENT_ROOTS = ['app', 'components', 'constants', 'contexts', 'hooks', 'i18n', 'lib', 'src']
const CONFIG_FILES = ['.env.example', 'app.json', 'eas.json', 'vite.config.js', 'vite.config.ts', 'deploy/expo-web/vercel.json', 'vercel.json']
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/
const PUBLIC_NAME = /\b(?:EXPO_PUBLIC|VITE)_[A-Z0-9_]+\b/g
const SECRET_WORD = /SECRET|SERVICE|PRIVATE|PASSWORD|TOKEN|ANTHROPIC|OPENAI|STRIPE|PAYSERA|RESEND|VAPID|API_KEY/

export function secretPublicNames(source) {
  return [...new Set(source.match(PUBLIC_NAME) ?? [])].filter((n) => SECRET_WORD.test(n) && !/_ANON_KEY$/.test(n))
}

// Shapes of real keys, long enough that the short fakes in the redaction tests do not match.
const REAL_KEY = /sk-ant-[A-Za-z0-9_-]{60,}|sk_live_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}/

export function jwtRoles(source) {
  return (source.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []).map((j) => {
    try {
      return JSON.parse(Buffer.from(j.split('.')[1], 'base64url').toString()).role ?? null
    } catch {
      return null
    }
  })
}

function files(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'locales' ? [] : files(p)
    return EXT.test(e.name) ? [p] : []
  })
}

const sources = () => [...CLIENT_ROOTS.flatMap(files), ...CONFIG_FILES.filter((f) => fs.existsSync(f))]

test('the guard spots secret-named public variables and server keys', () => {
  assert.deepEqual(secretPublicNames('process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY'), ['EXPO_PUBLIC_ANTHROPIC_API_KEY'])
  assert.deepEqual(secretPublicNames('import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY'), ['VITE_SUPABASE_SERVICE_ROLE_KEY'])
  assert.deepEqual(secretPublicNames('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, VITE_SITE_URL'), [])
  const serviceJwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signaturesignature'].join('.')
  assert.deepEqual(jwtRoles(serviceJwt), ['service_role'])
})

test('no secret-named variable is given a public (bundled) name', () => {
  const found = sources().flatMap((f) => secretPublicNames(fs.readFileSync(f, 'utf8')).map((n) => `${f}: ${n}`))
  assert.deepEqual(found, [])
})

test('no real key or service-role token is written into app or website code', () => {
  const found = sources().flatMap((f) => {
    const s = fs.readFileSync(f, 'utf8')
    const hits = []
    if (REAL_KEY.test(s)) hits.push(`${f}: key-shaped string`)
    if (jwtRoles(s).some((r) => r && r !== 'anon')) hits.push(`${f}: non-anon Supabase token`)
    return hits
  })
  assert.deepEqual(found, [])
})

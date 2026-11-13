import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// AUDIT-014: every environment variable the apps or app.config.js read is
// documented in .env.example, so a new machine or a new hosting project can be
// set up from that one file.

// Tooling and test-only names, documented where they are used (CLAUDE.md,
// playwright configs, scripts), not app configuration.
const TOOLING = new Set([
  'DEV', 'EXPO_PUBLIC_', 'VITE_', 'EXPO_NO_REDIRECT_PAGE', 'EXPO_PACKAGER_PROXY_URL',
  'PW_CHROMIUM_PATH', 'REACT_NATIVE_PACKAGER_HOSTNAME', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'locales'].includes(e.name)) walk(p, out) }
    else if (/\.(tsx?|jsx?|cjs|mjs)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p)
  }
  return out
}

test('every env var the apps read is in .env.example', () => {
  const files = ['app', 'components', 'contexts', 'hooks', 'lib', 'src', 'constants', 'i18n'].flatMap((d) => (fs.existsSync(d) ? walk(d) : []))
  files.push('app.config.js')
  const used = new Set()
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z_0-9]+)/g)) used.add(m[1])
  }
  const example = fs.readFileSync('.env.example', 'utf8')
  const missing = [...used].filter((v) => !TOOLING.has(v) && !new RegExp(`\\b${v}\\b`).test(example)).sort()
  assert.deepEqual(missing, [])
})

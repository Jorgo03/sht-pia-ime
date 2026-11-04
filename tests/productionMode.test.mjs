// Production mode and no debug output for strangers (AUDIT.md Pass 39).
// - Both sites are built in production mode, without source maps.
// - Error screens show a short translated message, never error text or code.
// - Shipped code prints nothing in production: diagnostics go through the
//   development-only loggers (lib/debug.ts, src/lib/debug.js), and crashes
//   are reported, redacted, to the private client_errors table.
// - Server functions answer with short error codes; details stay in their
//   private logs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const EXT = /\.(ts|tsx|js|jsx)$/
function files(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'locales' ? [] : files(p)
    return EXT.test(e.name) && !/\.test\./.test(e.name) ? [p.replace(/\\/g, '/')] : []
  })
}

test('both sites build in production mode without source maps', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts.build, 'vite build')
  assert.doesNotMatch(pkg.scripts['build:web-expo'], /--dev\b|--source-maps|--no-minify/)
  assert.doesNotMatch(read('vite.config.js'), /sourcemap:\s*true/)
  const deploy = JSON.parse(read('deploy/expo-web/vercel.json'))
  assert.doesNotMatch(deploy.buildCommand, /--dev\b|--source-maps|--no-minify/)
})

test('error screens never show the error itself', () => {
  for (const f of ['components/ui/error-boundary.tsx', 'src/shared/ErrorBoundary.jsx']) {
    const src = read(f)
    const view = src.slice(src.indexOf('return ('))
    assert.doesNotMatch(view, /\{\s*(this\.state\.)?error(\?)?\.(message|stack)|componentStack\}/, `${f} renders no error text`)
  }
})

test('shipped code prints nothing outside development', () => {
  const ALLOWED = {
    'lib/debug.ts': /if \(!__DEV__\) return;/,
    'src/lib/debug.js': /if \(!import\.meta\.env\?\.DEV\) return/,
    'components/ui/error-boundary.tsx': /if \(__DEV__\) \{\n\s+\/\/[^\n]*\n\s+console\.error/,
    'src/shared/ErrorBoundary.jsx': /if \(import\.meta\.env\?\.DEV\) \{\n\s+console\.error/,
    'contexts/auth-context.tsx': /if \(!__DEV__\) return;\n\s+console\.log\(`\[oauth\]/,
  }
  const bad = []
  for (const f of ['app', 'components', 'contexts', 'hooks', 'lib', 'src'].flatMap(files)) {
    const src = read(f)
    if (!/console\.(log|debug|info|trace|error|warn)\(/.test(src)) continue
    if (ALLOWED[f] && ALLOWED[f].test(src)) continue
    bad.push(f)
  }
  assert.deepEqual(bad, [])
})

test('server functions answer with short codes, not error details', () => {
  const leak = /json\(\{[^}]*\b(err|error|e)\.(message|stack|details|hint)|new Response\([^)]*\b(err|error)\.(message|stack)/
  const found = files('supabase/functions').filter((f) => leak.test(read(f)))
  assert.deepEqual(found, [])
})

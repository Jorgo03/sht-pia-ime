// CSRF (AUDIT.md Pass 35): another website can only act as a signed-in user
// if the browser sends that user's login along by itself, which is what
// cookies do. Here the session lives in localStorage / AsyncStorage and every
// request carries it in an Authorization header the app adds; browsers never
// add that header to another site's request. This fails if cookie-based login
// creeps in, or if a function that changes data stops checking its caller.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['app', 'components', 'contexts', 'hooks', 'lib', 'src', 'supabase/functions']
const EXT = /\.(ts|tsx|js|jsx|mjs)$/

function files(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'locales' ? [] : files(p)
    return EXT.test(e.name) ? [p] : []
  })
}
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const all = ROOTS.flatMap(files).map((f) => ({ f: f.replace(/\\/g, '/'), s: read(f) }))

test('nothing keeps a login in cookies', () => {
  const COOKIE = /document\.cookie|set-cookie|@supabase\/ssr|js-cookie|credentials:\s*['"]include['"]|withCredentials/i
  assert.deepEqual(all.filter(({ s }) => COOKIE.test(s)).map(({ f }) => f), [])
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  assert.equal('@supabase/ssr' in deps || 'js-cookie' in deps, false)
})

test('both Supabase clients keep the session in local storage, not cookies', () => {
  const web = read('src/lib/supabase.js')
  assert.match(web, /storage: resolveAuthStorage\(\)/)
  assert.match(web, /return window\.localStorage/)
  const app = read('lib/supabase.ts')
  assert.match(app, /\n\s+storage,\n/)
  assert.match(app, /@react-native-async-storage\/async-storage/)
  assert.match(app, /window\.localStorage\.getItem/)
})

test('every server function that changes data checks who is calling', () => {
  // How each one knows its caller: a user's token, a scheduler secret, the
  // payment provider's signature, or a secret link token.
  const RULES = {
    'checkout-start': /Authorization/,
    'delete-account': /Authorization/,
    'push-dispatch': /push_dispatch_secret_ok/,
    'saved-search-alerts': /CRON_SECRET/,
    'paysera-callback': /verifyCallback/,
    'saved-search-unsubscribe': /UUID\.test\(token\)/,
  }
  for (const [fn, rule] of Object.entries(RULES)) {
    const src = read(`supabase/functions/${fn}/index.ts`)
    assert.match(src, rule, `${fn} checks its caller`)
  }
  // An unsubscribe link only shows a confirm button; the change needs a POST.
  const unsub = read('supabase/functions/saved-search-unsubscribe/index.ts')
  assert.match(unsub, /if \(req\.method === 'GET'\) return html\(CONFIRM\(token\)\)/)
})

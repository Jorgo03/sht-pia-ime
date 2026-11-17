// Every screen outside the tabs is declared in the root stack (app/_layout.tsx)
// with the system header off. A new route that was not (user/[id]) showed the
// system bar on iPhone with the file paths as text: "< messages/[id]  user/[id]"
// (2026-11-12).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

function routes(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== '(tabs)') routes(p, out)
    } else if (/\.tsx$/.test(e.name) && !['_layout.tsx', '+html.tsx'].includes(e.name)) {
      out.push(path.relative('app', p).replace(/\\/g, '/').replace(/(\.web)?\.tsx$/, ''))
    }
  }
  return out
}

test('every route outside the tabs is in the root stack with no system header', () => {
  const layout = read('app/_layout.tsx')
  const declared = new Map(
    [...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"\s+options=\{\{([^}]*)\}\}/g)].map((m) => [m[1], m[2]]),
  )
  const missing = [...new Set(routes('app'))].filter((r) => !declared.has(r)).sort()
  assert.deepEqual(missing, [])
  const shown = [...declared].filter(([, options]) => !/headerShown:\s*false/.test(options)).map(([name]) => name)
  assert.deepEqual(shown, [])
  assert.match(layout, /<Stack screenOptions=\{\{\s*headerShown:\s*false\s*\}\}>/, 'off by default too')
})

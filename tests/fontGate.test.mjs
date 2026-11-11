// Every font a screen uses must be loaded before the first screen
// (app/_layout.tsx useFonts). One loaded afterwards leaves text that was
// already drawn in the system font. A search that missed `Fonts?.x` once
// moved two used fonts out of the set (2026-11-11).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

function sources(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) sources(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

test('the fonts screens use are all loaded before the first screen', () => {
  const theme = read('constants/theme.ts')
  const block = /export const Fonts = \{([\s\S]*?)\n\};/.exec(theme)
  assert.ok(block, 'constants/theme.ts exports Fonts')
  const family = Object.fromEntries([...block[1].matchAll(/^\s*(\w+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]))
  assert.ok(Object.keys(family).length >= 8, 'Fonts keys found')

  const used = new Set()
  for (const dir of ['app', 'components', 'hooks', 'contexts', 'lib']) {
    for (const f of sources(dir)) for (const m of read(f).matchAll(/Fonts\??\.(\w+)/g)) used.add(m[1])
  }

  const layout = read('app/_layout.tsx')
  const gate = /useFonts\(\{([\s\S]*?)\}\)/.exec(layout)
  assert.ok(gate, 'app/_layout.tsx calls useFonts')
  const loaded = new Set([...gate[1].matchAll(/\b([A-Z]\w+_\d{3}\w*)\b/g)].map((m) => m[1]))

  const missing = [...used].filter((k) => family[k] && !loaded.has(family[k])).map((k) => `${k} (${family[k]})`)
  assert.deepEqual(missing, [])
})

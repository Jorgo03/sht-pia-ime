import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Usability floor for people of every age (docs/USABILITY_REVIEW.md): text
// large enough to read, words beside the pictures that matter, and a
// question before anything is deleted.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx$/.test(e.name) && !/\.web\.tsx$/.test(e.name)) files.push(p)
  }
}
for (const d of ['app', 'components']) walk(path.join(root, d))

// Fixed bubbles: map clusters and the unread count on the menu.
const SMALL_ALLOWED = new Set(['components/map/cluster-marker.tsx', 'components/map/county-marker.tsx'])

test('no phone-app text is smaller than 12', () => {
  const tiny = []
  for (const f of files) {
    const rel = path.relative(root, f).replace(/\\/g, '/')
    if (SMALL_ALLOWED.has(rel)) continue
    const src = fs.readFileSync(f, 'utf8').replace(/navBadgeText: \{\s*fontSize: 10/, '')
    for (const m of src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)) if (Number(m[1]) < 12) tiny.push(`${rel}: ${m[1]}`)
  }
  assert.deepEqual(tiny, [])
})

test('the bottom menu draws a word under each icon', () => {
  const bar = read('components/liquid-tab-bar.tsx')
  assert.match(bar, /styles\.navLabel/)
  assert.match(bar, /t\('common\.addShort'\)/)
})

test('deleting a saved search or a wanted home asks first', () => {
  const screen = read('app/saved-searches/index.tsx')
  assert.match(screen, /onPress=\{\(\) => askDeleteSearch\(/)
  assert.match(screen, /onPress=\{\(\) => askDeleteWanted\(/)
  assert.equal((screen.match(/confirmAction\(\{/g) || []).length >= 2, true)
})

test('Messages in the Profile menu has a message picture', () => {
  assert.match(read('app/(tabs)/profile.tsx'), /name="chat-bubble-outline"[^\n]*\n\s*<Text style=\{styles\.menuRowText\}>\{t\('common\.messages'\)\}/)
})

test('over a dark header the status bar icons are light, only while that screen is on top', () => {
  const header = read('components/ui/app-header.tsx')
  assert.ok(header.includes('(onDark || floating) && <LightStatusBarWhileFocused />'))
  assert.ok(header.includes('focused ? <StatusBar style="light" /> : null'))
  assert.match(header, /HEADER_TOP_PADDING = 16/)
  // The bar's colour runs up behind the clock and battery.
  assert.match(header, /marginTop: -insets.top, paddingTop: insets.top + HEADER_TOP_PADDING/)
})

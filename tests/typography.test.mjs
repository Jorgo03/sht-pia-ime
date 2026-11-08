import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HEADLINE_FONT_FILES } from '../src/lib/headlineFonts.js'

// Samsung and iPhone drew the same screens in different fonts: a text style
// that names no font falls back to each phone's system font (Roboto on
// Android, San Francisco on iOS), and a fontWeight on one of the app's
// static font files is faked bold on Android but ignored on iOS. So in the
// phone app every text style names one of the brand's font files
// (constants/theme.ts Fonts, loaded in app/_layout.tsx) and none sets
// fontWeight: the file is the weight.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    // .web.tsx files only run on the website, which has its own CSS fonts.
    else if (/\.tsx?$/.test(e.name) && !/\.web\.tsx?$/.test(e.name)) files.push(p)
  }
}
for (const d of ['app', 'components']) walk(path.join(root, d))

const styleBlocks = function* () {
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(/\{[^{}]*\}/g)) {
      const line = src.slice(0, m.index).split('\n').length
      yield { where: `${path.relative(root, f)}:${line}`, block: m[0] }
    }
  }
}

test('every phone-app text style names a brand font file', () => {
  const missing = []
  for (const { where, block } of styleBlocks()) {
    if (/\bfontSize\s*:/.test(block) && !/fontFamily\s*:/.test(block) && !/\.\.\./.test(block)) missing.push(where)
  }
  assert.deepEqual(missing, [], 'add fontFamily: Fonts.<weight> (constants/theme.ts)')
})

test('no phone-app style sets fontWeight: pick the weight file instead', () => {
  const weights = []
  for (const { where, block } of styleBlocks()) {
    if (/\bfontWeight\s*:/.test(block)) weights.push(where)
  }
  assert.deepEqual(weights, [], 'use Fonts.sansMedium / sansSemiBold / sansBold, not fontWeight')
})

test('no phone-app style sets fontStyle: Android fakes a slant, iOS ignores it', () => {
  const italics = []
  for (const { where, block } of styleBlocks()) {
    if (/\bfontStyle\s*:/.test(block)) italics.push(where)
  }
  assert.deepEqual(italics, [], 'use Fonts.serifItalic, the real italic file')
})

test('every font file the styles name is loaded before or right after first paint', () => {
  const theme = fs.readFileSync(path.join(root, 'constants/theme.ts'), 'utf8')
  const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8')
  const fontsBlock = /export const Fonts = \{([\s\S]*?)\n\};/.exec(theme)[1]
  const families = [...fontsBlock.matchAll(/:\s*'([A-Za-z]+_\d{3}[A-Za-z_]*)'/g)].map((m) => m[1])
  assert.ok(families.length >= 7, 'Fonts tokens found')
  // The headline getters answer from src/lib/headlineFonts.js.
  assert.match(fontsBlock, /get serif\(\)[\s\S]*headlineFont\('serif'/)
  families.push(...HEADLINE_FONT_FILES)
  for (const family of families) assert.match(layout, new RegExp(`\\b${family}\\b`), `${family} is loaded in app/_layout.tsx`)
})

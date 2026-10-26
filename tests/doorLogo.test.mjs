import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ARCH, DOOR, KNOB, DOOR_COLOR, SPLASH, SPLASH_IMAGE_WIDTH, HINGE, TIMELINE, toSplashBox } from '../src/features/brand/doorLogo.js'

// The launch animation (components/brand/door-splash.tsx) must use the logo as
// it is: these pin its parts to the brand master files.

const svg = (name) => fs.readFileSync(new URL(`../assets/brand/${name}`, import.meta.url), 'utf8')
const pathOf = (s) => s.match(/ d="([^"]+)"/)[1]
const fillOf = (s) => s.match(/fill="([^"]+)"/)[1]

test('arch + door + knob is the original logo path, character for character', () => {
  assert.equal(ARCH + DOOR + KNOB, pathOf(svg('symbol-orange.svg')))
  assert.equal(ARCH + DOOR + KNOB, pathOf(svg('splash-icon.svg')))
})

test('the orange is the brand orange', () => {
  assert.equal(DOOR_COLOR, fillOf(svg('symbol-orange.svg')))
})

test('the animation places the symbol exactly where the native splash image does', () => {
  assert.match(svg('splash-icon.svg'), new RegExp(`transform="translate\\(${SPLASH.x} ${SPLASH.y}\\) scale\\(${SPLASH.scale}\\)"`))
  assert.match(svg('splash-icon.svg'), new RegExp(`viewBox="0 0 ${SPLASH.viewBox} ${SPLASH.viewBox}"`))
  const app = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
  const splash = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1]
  assert.equal(splash.imageWidth, SPLASH_IMAGE_WIDTH)
  assert.equal(splash.image, './assets/images/splash-door.png')
})

test('the hinge is the door\'s tall right edge, and the knob sits near the free edge', () => {
  // End points only: drop the arcs' radius pairs (A4,4).
  const xs = [...DOOR.replace(/A4,4/g, 'A').matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]))
  assert.equal(HINGE.x, Math.max(...xs))
  const knobX = 131 + 10
  assert.ok(knobX - Math.min(...xs) < HINGE.x - knobX, 'knob is closer to the free edge')
  // Box mapping: the hinge lands inside the 200-pt splash box.
  const h = toSplashBox(HINGE)
  assert.ok(h.x > 100 && h.x < 200 && h.y > 50 && h.y < 150)
})

test('about two seconds, in order', () => {
  const t = TIMELINE
  assert.ok(t.doorStart < t.doorEnd && t.doorEnd <= t.enterStart && t.enterStart < t.fadeStart && t.fadeStart < t.end)
  assert.equal(t.end, 2000)
  assert.ok(t.reducedHold + t.reducedFade <= 500)
})

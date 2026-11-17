import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// AUDIT-005: viewings are at a home in Albania, so their times are Tirana
// time on every device. Before, a buyer whose phone was set to London who
// asked for 10:00 booked 10:00 London time, which is 11:00 in Tirana, and the
// agent saw 11:00. These run with the device in London.
process.env.TZ = 'Europe/London'
const {
  formatViewingWhen, formatViewingClock, fromTiranaWallTime, localWallAsTirana,
  tiranaWallAsLocal, deviceUsesTiranaTime, tiranaDayStart,
} = await import('../src/lib/tiranaTime.js')

test('a Tirana wall time is the right instant, winter and summer', () => {
  assert.equal(fromTiranaWallTime(2026, 11, 20, 10, 0).toISOString(), '2026-11-20T09:00:00.000Z')
  assert.equal(fromTiranaWallTime(2026, 7, 10, 10, 0).toISOString(), '2026-07-10T08:00:00.000Z')
})

test('times are shown in Tirana time, whatever the device zone', () => {
  const iso = '2026-11-20T09:00:00.000Z'
  assert.equal(formatViewingClock(iso), '10:00')
  assert.equal(formatViewingWhen(iso), '20/11/2026 · 10:00')
  // Just before midnight UTC is already the next day in Tirana.
  assert.equal(formatViewingWhen('2026-11-20T23:30:00.000Z'), '21/11/2026 · 00:30')
})

test('a picker working in device time round-trips through Tirana time', () => {
  const picked = new Date(2026, 10, 20, 10, 0) // the wheel shows 10:00
  const instant = localWallAsTirana(picked)
  assert.equal(instant.toISOString(), '2026-11-20T09:00:00.000Z')
  const back = tiranaWallAsLocal(instant)
  assert.equal(back.getHours(), 10)
  assert.equal(back.getDate(), 20)
})

test('the device in London is not on Tirana time; Tirana day starts at 23:00 UTC in winter', () => {
  assert.equal(deviceUsesTiranaTime(new Date('2026-11-20T09:00:00Z')), false)
  assert.equal(tiranaDayStart(new Date('2026-11-20T15:00:00Z')).toISOString(), '2026-11-19T23:00:00.000Z')
})

test('every viewing time on screen goes through the Tirana helpers', () => {
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const files = [
    'app/viewings/index.tsx', 'app/agent-dashboard/index.tsx',
    'src/features/viewings/pages/Viewings.jsx', 'src/features/listings/pages/AgentDashboard.jsx',
  ]
  for (const f of files) {
    const src = read(f)
    assert.doesNotMatch(src, /Intl\.DateTimeFormat\([^)]*hour/, `${f}: no device-zone clock`)
    assert.match(src, /formatViewing(When|Clock)\(/, `${f}: uses the Tirana formatter`)
  }
  for (const f of ['components/viewings/viewing-time-picker.native.tsx', 'components/viewings/viewing-time-picker.web.tsx', 'src/features/viewings/components/ViewingRequestSheet.jsx']) {
    assert.match(read(f), /localWallAsTirana\(/, `${f}: the picked time is Tirana time`)
  }
})

test('the Tirana time label exists in all 8 locales', () => {
  for (const l of ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    const j = JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'))
    assert.equal(typeof j.viewings.tiranaTime, 'string', l)
  }
})

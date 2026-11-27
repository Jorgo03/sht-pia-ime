import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { askEra, readQuestion } from '../src/features/assistant/lib/era.js'

const search = (q) => {
  const r = readQuestion(q)
  assert.equal(r.kind, 'search', `${q} -> ${JSON.stringify(r)}`)
  return r.criteria
}

test('the owner\'s example: all apartments for sale in Durrës', () => {
  assert.deepEqual(search('Me gjej te gjitha apartamentet ne shitje ne durres?'), { listing_type: 'sale', property_type: 'apartment', city: 'Durrës' })
})

test('rooms, budget, area, amenities and order are read; area is never a price', () => {
  assert.deepEqual(search('2+1 me qira në Tiranë deri në 500 €'), { listing_type: 'rent', city: 'Tiranë', max_price_eur: 500, beds: 2 })
  assert.deepEqual(search('vile ne vlore nen 300 mije euro me pishine'), { property_type: 'villa', city: 'Vlorë', max_price_eur: 300000, required_features: ['pool'] })
  assert.deepEqual(search('apartment for rent in Tirana with balcony, at least 80 m2'), { listing_type: 'rent', property_type: 'apartment', city: 'Tiranë', min_area: 80, required_features: ['balcony'] })
  assert.deepEqual(search('toka ne durresit 50.000 €'), { property_type: 'land', city: 'Durrës', max_price_eur: 50000 })
  assert.deepEqual(search('apartament ne tirane nen 30 milion lek'), { property_type: 'apartment', city: 'Tiranë', max_price_eur: Math.round(30000000 / 98) })
  assert.equal(search('me te lirat ne tirane').sort, 'price_asc')
  assert.equal(search('qira ditore ne sarande').listing_type, 'daily_rent')
  assert.equal(search('apartament pa ashensor ne fier').required_features, undefined)
})

test('the site name, years and everyday words are not read as homes, prices or cities', () => {
  assert.equal(readQuestion('Si funksionon Shtëpia.ime?').topic, 'howItWorks')
  assert.equal(search('apartament ne tirane i ndertuar pas 2015').max_price_eur, undefined)
  assert.equal(search('which apartment has a balcony').city, undefined)
  assert.equal(search('apartment in a good location').listing_type, undefined)
})

test('help questions get a topic; selling your own home is publishing, not a search', () => {
  assert.equal(readQuestion('Më ndihmo të publikoj një pronë').topic, 'publish')
  assert.equal(readQuestion('dua te shes shtepine time').topic, 'publish')
  assert.equal(readQuestion('Kërko prona sipas buxhetit tim').topic, 'budget')
  assert.equal(readQuestion('Më krahaso disa prona').topic, 'compare')
  assert.equal(readQuestion('Përshëndetje').topic, 'greeting')
  assert.equal(readQuestion('blablabla').topic, 'help')
  assert.equal(readQuestion('më shumë').kind, 'more')
  assert.equal(readQuestion('po me ashensor?').refine, true)
})

/** A stand-in for supabase-js: records the filters and returns `rows`. */
function fakeDb(rows, total = rows.length) {
  const calls = []
  const chain = {
    select: (...a) => (calls.push(['select', ...a]), chain),
    eq: (...a) => (calls.push(['eq', ...a]), chain),
    neq: (...a) => (calls.push(['neq', ...a]), chain),
    ilike: (...a) => (calls.push(['ilike', ...a]), chain),
    or: (...a) => (calls.push(['or', ...a]), chain),
    gte: (...a) => (calls.push(['gte', ...a]), chain),
    lte: (...a) => (calls.push(['lte', ...a]), chain),
    contains: (...a) => (calls.push(['contains', ...a]), chain),
    order: (...a) => (calls.push(['order', ...a]), chain),
    range: (...a) => (calls.push(['range', ...a]), Promise.resolve({ data: rows, count: total, error: null })),
  }
  return { calls, from: () => chain }
}

const sq = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/sq.json', import.meta.url)))
const t = (key, opts = {}) => {
  let node = sq
  const parts = key.split('.')
  const last = parts.pop()
  for (const p of parts) node = node?.[p]
  let s = node?.[last] ?? (opts.count !== undefined ? node?.[`${last}_${opts.count === 1 ? 'one' : 'other'}`] : undefined)
  assert.equal(typeof s, 'string', `missing ${key}`)
  for (const [k, v] of Object.entries(opts)) s = s.replaceAll(`{{${k}}}`, String(v))
  return s
}
const row = (i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `A${i}`, price: 90000, currency: 'EUR', listing_type: 'sale', property_type: 'apartment', city: 'Durrës', image_urls: [], features: [], created_at: '2026-11-01T00:00:00Z', status: 'active' })

test('Era counts, answers in the owner\'s words and shows the listings under the answer', async () => {
  const db = fakeDb([row(1), row(2)], 10)
  const a = await askEra({ db, question: 'Me gjej te gjitha apartamentet ne shitje ne durres?', state: null, t })
  assert.match(a.reply, /^Po llogaris tani\. Rezultati: 10 apartamente në shitje në Durrës\./)
  assert.equal(a.cards.length, 2)
  assert.deepEqual(a.state.criteria, { listing_type: 'sale', property_type: 'apartment', city: 'Durrës' })
  assert.ok(db.calls.some((c) => c[0] === 'eq' && c[1] === 'status' && c[2] === 'active'))
  assert.ok(db.calls.some((c) => c[0] === 'ilike' && c[1] === 'city'))

  const follow = await askEra({ db: fakeDb([row(3)], 1), question: 'po me ashensor?', state: a.state, t })
  assert.deepEqual(follow.state.criteria, { listing_type: 'sale', property_type: 'apartment', city: 'Durrës', required_features: ['elevator'] })
  assert.match(follow.reply, /Rezultati: 1 apartament në shitje në Durrës\./)
})

test('no match says so; "more" pages on; a help topic keeps the search', async () => {
  const none = await askEra({ db: fakeDb([], 0), question: 'vila me qira ne kukes', state: null, t })
  assert.match(none.reply, /nuk ka vila me qira në Kukës/)
  assert.equal(none.cards.length, 0)

  const first = await askEra({ db: fakeDb(Array.from({ length: 12 }, (_, i) => row(i)), 30), question: 'apartamente ne durres', state: null, t })
  const more = fakeDb([row(99)], 30)
  const next = await askEra({ db: more, question: 'më shumë', state: first.state, t })
  assert.ok(more.calls.some((c) => c[0] === 'range' && c[1] === 12 && c[2] === 23))
  assert.equal(next.state.offset, 12)

  const help = await askEra({ db: fakeDb([]), question: 'si te publikoj?', state: first.state, t })
  assert.deepEqual(help.cards, [])
  assert.deepEqual(help.state, first.state)
  assert.deepEqual(help.screens.map((s) => s.key), ['create_listing', 'my_listings'])
})

test('every Era string exists in all 10 languages, with the plural forms each needs', () => {
  const dir = new URL('../src/i18n/locales/', import.meta.url)
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
  const base = keys(sq.era.local).filter((k) => !/_(few|many)$/.test(k)).sort()
  for (const file of fs.readdirSync(dir)) {
    const loc = JSON.parse(fs.readFileSync(new URL(file, dir)))
    const own = new Set(keys(loc.era?.local ?? {}))
    for (const k of base) assert.ok(own.has(k), `${file} is missing era.local.${k}`)
    if (file === 'ru.json' || file === 'pl.json') for (const k of base.filter((k) => k.endsWith('_one'))) for (const f of ['few', 'many']) assert.ok(own.has(k.replace(/_one$/, `_${f}`)), `${file} ${k} ${f}`)
  }
})

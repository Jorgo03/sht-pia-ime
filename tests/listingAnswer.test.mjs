import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import i18next from 'i18next'

import { answerAboutListing } from '../src/features/properties/lib/listingAnswer.js'

const load = (lang) => JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${lang}.json`, import.meta.url)))
const i18n = i18next.createInstance()
await i18n.init({ lng: 'sq', interpolation: { escapeValue: false }, resources: { sq: { translation: load('sq') }, en: { translation: load('en') } } })
const sq = i18n.getFixedT('sq')
const en = i18n.getFixedT('en')

const listing = {
  price: 120000, currency: 'EUR', listing_type: 'sale', property_type: 'apartment', city: 'Durrës', zone: 'Plazh',
  address: 'Rruga Taulantia', sqft: 80, beds: 2, baths: 1, floor: 5, total_floors: 9, year_built: 2019,
  features: ['balcony', 'elevator'], status: 'active',
  description: 'Apartament me pamje nga deti. Ndodhet 200 metra nga plazhi. Kuzhina është e re.',
}
const ask = (q, t = sq, p = listing) => answerAboutListing(q, p, t, t === en ? 'en' : 'sq')

test('answers from the listing\'s own fields, without sending anyone to the seller', () => {
  assert.equal(ask('Sa dhoma ka?').reply, 'Ka 2 dhoma gjumi.')
  assert.equal(ask('Në cilin kat është?').reply, 'Është në katin 5 nga 9.')
  assert.equal(ask('Ku ndodhet?').reply, 'Ndodhet në: Rruga Taulantia, Plazh, Durrës.')
  assert.equal(ask('Kur është ndërtuar?').reply, 'Është ndërtuar në vitin 2019.')
  assert.equal(ask('A është ende e disponueshme?').reply, 'Po, shpallja është aktive.')
  assert.equal(ask('is it for sale or rent?', en).reply, 'This listing: apartment for sale.')
  assert.equal(ask('how many bathrooms?', en).reply, 'It has 1 bathroom.')
  const price = ask('Sa kushton?')
  assert.match(price.reply, /^Çmimi është 120\s?000\s€\. Rreth 1\s?500\s€ për m²\.$/)
  assert.equal(price.contact, false)
})

test('a rent shows its price per month, and no price per m²', () => {
  const r = ask('sa kushton?', sq, { ...listing, listing_type: 'rent', price: 450 })
  assert.match(r.reply, /450\s€/)
  assert.ok(r.reply.includes(sq('property.perMonth')))
  assert.ok(!r.reply.includes('m²'))
})

test('an amenity it has is a yes; one it does not list is not a "no": the seller is offered', () => {
  const r = ask('A ka ashensor dhe parkim?')
  assert.match(r.reply, /Ashensor: po/)
  assert.match(r.reply, /Parking: shpallja nuk e përmend/)
  assert.equal(r.contact, true)
})

test('the description answers what the fields do not; nothing found hands over to the seller', () => {
  assert.deepEqual(ask('A ka pamje nga deti?'), { reply: 'Në përshkrim thuhet: “Apartament me pamje nga deti.”', contact: false })
  assert.deepEqual(ask('A pranohen kafshë?'), { reply: sq('assistant.notInListing'), contact: true })
  assert.deepEqual(ask('Kush është agjenti?'), { reply: sq('assistant.notInListing'), contact: true })
  assert.equal(ask('Sa metra katror?', sq, { ...listing, sqft: null }).contact, true)
})

test('short words are whole words: "kush" (who) is not "ku" (where), "kushton" is a price', () => {
  assert.ok(!ask('Sa kushton?').reply.includes('Ndodhet'))
})

test('every assistant.local string exists in all 10 languages', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
  const base = keys(load('sq').assistant.local)
  for (const file of fs.readdirSync(new URL('../src/i18n/locales/', import.meta.url))) {
    const own = new Set(keys(load(file.replace('.json', '')).assistant?.local ?? {}))
    for (const k of base) assert.ok(own.has(k), `${file} is missing assistant.local.${k}`)
  }
})

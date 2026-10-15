import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closedStatusFor, formToColumns, propertyToForm } from '../src/features/listings/lib/listingForm.js'

// Editing a listing loads a saved row into the wizard and saves it back
// (AUDIT.md Pass 14, P0-5). Both apps share these two conversions, so a field
// that survives one app's round trip survives the other's.

const ROW = {
  id: 'p1',
  owner_id: 'u1',
  agent_id: 'u1',
  title: 'Apartament 2+1',
  title_i18n: { sq: 'Apartament 2+1', en: '2+1 apartment' },
  description: 'Përshkrim',
  description_i18n: { sq: 'Përshkrim', en: 'Description' },
  translation_meta: { en: { manual: true, sourceHash: 'abc', updatedAt: '2026-10-01' } },
  listing_type: 'sale',
  property_type: 'apartment',
  city: 'Durrës',
  address: 'Rruga e Plazhit 4',
  latitude: 41.31,
  longitude: 19.45,
  price: 95000,
  currency: 'EUR',
  sqft: 72,
  beds: 2,
  baths: 1,
  floor: 0,
  total_floors: 6,
  year_built: null,
  features: ['balcony', 'elevator'],
  contact_phone: '+355 69 000 0001',
  whatsapp_enabled: false,
  contact_email: null,
  image_urls: ['https://x/a.jpg'],
  video_url: null,
  status: 'paused',
}

test('a saved listing loads into the form with every field', () => {
  const form = propertyToForm(ROW)
  assert.equal(form.title_i18n.en, '2+1 apartment')
  assert.equal(form.description_i18n.sq, 'Përshkrim')
  assert.equal(form.translation_meta.en.manual, true, 'hand-edited translations stay marked as manual')
  assert.equal(form.city, 'Durrës')
  assert.equal(form.price, '95000')
  assert.equal(form.sqft, '72')
  assert.equal(form.floor, '0', 'ground floor is a real value, not empty')
  assert.equal(form.year_built, '', 'missing values load as empty fields')
  assert.equal(form.whatsapp_enabled, false)
  assert.equal(form.contact_email, '')
  assert.deepEqual(form.features, ['balcony', 'elevator'])
})

test('an old listing with only the plain title still loads its Albanian text', () => {
  const form = propertyToForm({ ...ROW, title_i18n: null, description_i18n: null, translation_meta: null })
  assert.equal(form.title_i18n.sq, 'Apartament 2+1')
  assert.equal(form.description_i18n.sq, 'Përshkrim')
  assert.deepEqual(form.translation_meta, {})
})

test('saving writes the same values back (round trip)', () => {
  const form = propertyToForm(ROW)
  const cols = formToColumns(form, form)
  for (const key of ['title', 'listing_type', 'property_type', 'city', 'address', 'latitude', 'longitude', 'price', 'currency', 'sqft', 'beds', 'baths', 'floor', 'total_floors', 'year_built', 'whatsapp_enabled', 'contact_phone']) {
    assert.deepEqual(cols[key], ROW[key], key)
  }
  assert.deepEqual(cols.title_i18n, ROW.title_i18n)
  assert.deepEqual(cols.translation_meta, ROW.translation_meta)
  assert.equal(cols.contact_email, null, 'empty optional text is stored as null')
})

test('saving never touches ownership, status or media', () => {
  const cols = formToColumns(propertyToForm(ROW), propertyToForm(ROW))
  for (const key of ['id', 'owner_id', 'agent_id', 'owner_type', 'status', 'image_urls', 'video_url', 'promoted_until']) {
    assert.equal(key in cols, false, key)
  }
})

test('numbers typed into the form are stored as numbers', () => {
  const form = { ...propertyToForm(ROW), price: '120000', floor: '', total_floors: '7', beds: '' }
  const cols = formToColumns(form, form)
  assert.equal(cols.price, 120000)
  assert.equal(cols.floor, null)
  assert.equal(cols.total_floors, 7)
  assert.equal(cols.beds, 0)
})

test('the translated maps passed in win over the form (translateAll result)', () => {
  const form = propertyToForm(ROW)
  const translated = {
    title_i18n: { ...form.title_i18n, de: 'Wohnung' },
    description_i18n: form.description_i18n,
    translation_meta: { ...form.translation_meta, de: { manual: false, sourceHash: 'abc' } },
  }
  const cols = formToColumns(form, translated)
  assert.equal(cols.title_i18n.de, 'Wohnung')
  assert.equal(cols.translation_meta.de.manual, false)
})

test('closing a listing: sale becomes sold, rent becomes rented', () => {
  assert.equal(closedStatusFor('sale'), 'sold')
  assert.equal(closedStatusFor('rent'), 'rented')
  assert.equal(closedStatusFor('daily_rent'), 'rented')
})

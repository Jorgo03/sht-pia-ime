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

// L07: media removed in an edit is deleted from storage after a successful save.
import { removedMediaPaths } from '../src/features/listings/lib/listingForm.js'
const BASE = 'https://x.supabase.co/storage/v1/object/public/property-images/'

test('removed photos of your own folder are the ones to delete', () => {
  const before = [`${BASE}u1/a.jpg`, `${BASE}u1/b.jpg`, `${BASE}u1/video-1.mp4`]
  const after = [`${BASE}u1/b.jpg`]
  assert.deepEqual(removedMediaPaths({ before, after, userId: 'u1' }), ['u1/a.jpg', 'u1/video-1.mp4'])
})

test('nothing kept is deleted, and nothing outside your folder or bucket', () => {
  const before = [`${BASE}u2/other-agent.jpg`, 'https://images.unsplash.com/photo-1', `${BASE}u1/../u2/x.jpg`, null]
  assert.deepEqual(removedMediaPaths({ before, after: [], userId: 'u1' }), [])
  assert.deepEqual(removedMediaPaths({ before: [`${BASE}u1/a.jpg`], after: [`${BASE}u1/a.jpg`], userId: 'u1' }), [])
})

test('encoded names and query strings resolve to the stored path; no user, nothing', () => {
  assert.deepEqual(removedMediaPaths({ before: [`${BASE}u1/my%20photo.jpg?t=1`], after: [], userId: 'u1' }), ['u1/my photo.jpg'])
  assert.deepEqual(removedMediaPaths({ before: [`${BASE}u1/a.jpg`], after: [], userId: null }), [])
})

test('price box: separators are read as people write money, never shifting the amount', async () => {
  const { normalizeAmount } = await import('../src/features/listings/lib/listingForm.js')
  // Decimals: one separator, one or two digits after it.
  assert.equal(normalizeAmount('1500,50'), '1500.50')
  assert.equal(normalizeAmount('1500.5'), '1500.5')
  assert.equal(normalizeAmount('1500,'), '1500.', 'kept while typing')
  // Thousands: several separators, or exactly three digits after one.
  assert.equal(normalizeAmount('1.200.000'), '1200000')
  assert.equal(normalizeAmount('1,200,000'), '1200000')
  assert.equal(normalizeAmount('1.500'), '1500')
  assert.equal(normalizeAmount('120 000'), '120000')
  // Noise and empty input.
  assert.equal(normalizeAmount('€ 250'), '250')
  assert.equal(normalizeAmount('99,999'), '99999')
  assert.equal(normalizeAmount(''), '')
  assert.equal(normalizeAmount(null), '')
  assert.equal(Number(normalizeAmount('1500,50')), 1500.5)
  assert.equal(Number(normalizeAmount('1.200.000')), 1200000)
})

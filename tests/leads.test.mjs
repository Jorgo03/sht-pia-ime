import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEAD_STATUSES, leadRow, leadSearchFilter, matchesWanted, priceInEur, wantedMatches,
} from '../src/features/leads/lib/leads.js'

// The agent's lead manager and buyer-request matching (docs/BSP_CRM_ANALYSIS.md, phase 1).

test('the pipeline is exactly what the database allows, in order', () => {
  assert.deepEqual(LEAD_STATUSES, ['new', 'contacted', 'qualified', 'won', 'lost'])
})

test('a lead form becomes a clean row, or says what is wrong', () => {
  assert.deepEqual(leadRow({ name: '  Arben   Hoxha ', phone: ' 069 123 4567 ', email: ' Arben@Mail.AL ', notes: ' Kërkon 2+1 ', status: 'contacted' }), {
    row: { name: 'Arben Hoxha', phone: '069 123 4567', email: 'arben@mail.al', notes: 'Kërkon 2+1', status: 'contacted' },
    error: null,
  })
  assert.deepEqual(leadRow({ name: 'Ana', phone: '', email: '', notes: '   ' }).row, { name: 'Ana', phone: null, email: null, notes: null, status: 'new' })
  assert.equal(leadRow({ name: 'Ana', status: 'hacked' }).row.status, 'new')
  assert.equal(leadRow({ name: '   ' }).error, 'nameRequired')
  assert.equal(leadRow({ name: 'x'.repeat(121) }).error, 'tooLong')
  assert.equal(leadRow({ name: 'Ana', notes: 'x'.repeat(2001) }).error, 'tooLong')
  assert.equal(leadRow({ name: 'Ana', phone: 'call me' }).error, 'phoneInvalid')
  assert.equal(leadRow({ name: 'Ana', email: 'ana@' }).error, 'emailInvalid')
})

test('a lead search is one safe PostgREST filter', () => {
  assert.equal(leadSearchFilter('  '), null)
  assert.equal(leadSearchFilter(null), null)
  assert.equal(leadSearchFilter('Arben'), 'name.ilike.*Arben*,email.ilike.*Arben*,notes.ilike.*Arben*')
  // Digits match in order whatever the spacing; the local leading 0 is dropped.
  assert.equal(leadSearchFilter('069 123'), 'name.ilike.*069 123*,email.ilike.*069 123*,notes.ilike.*069 123*,phone.ilike.*6*9*1*2*3*')
  // Characters that would change the filter's shape or act as wildcards are removed.
  assert.equal(leadSearchFilter('a,b),status.eq.won(%_*'), 'name.ilike.*a b status eq won*,email.ilike.*a b status eq won*,notes.ilike.*a b status eq won*')
  // A pasted essay is cut to 60 characters per field.
  assert.ok(leadSearchFilter('x'.repeat(200)).includes('x'.repeat(60) + '*'))
  assert.ok(!leadSearchFilter('x'.repeat(200)).includes('x'.repeat(61)))
})

const listing = (over) => ({ status: 'active', city: 'Tiranë', listing_type: 'sale', price: 120000, currency: 'EUR', beds: 2, ...over })

test('a buyer request matches on city, sale or rent, budget in euros and bedrooms', () => {
  const want = { city: 'Tiranë', listing_type: 'sale', max_price: 150000, min_bedrooms: 2 }
  assert.equal(matchesWanted(want, listing()), true)
  assert.equal(matchesWanted({ ...want, city: 'tirana' }, listing()), true)
  assert.equal(matchesWanted(want, listing({ city: 'Durrës' })), false)
  assert.equal(matchesWanted(want, listing({ listing_type: 'rent' })), false)
  assert.equal(matchesWanted(want, listing({ price: 160000 })), false)
  // 14,000,000 lek is about €143,000: within €150,000.
  assert.equal(matchesWanted(want, listing({ price: 14_000_000, currency: 'ALL' })), true)
  assert.equal(matchesWanted(want, listing({ beds: 1 })), false)
  assert.equal(matchesWanted(want, listing({ beds: null })), false)
  assert.equal(matchesWanted(want, listing({ status: 'sold' })), false)
  // No budget or bedroom minimum: those do not filter.
  assert.equal(matchesWanted({ city: 'Tiranë', listing_type: 'sale', max_price: null, min_bedrooms: null }, listing({ price: 900000, beds: null })), true)
  assert.equal(matchesWanted(null, listing()), false)
})

test('matches come cheapest first, compared in euros', () => {
  const want = { city: 'Tiranë', listing_type: 'sale', max_price: null, min_bedrooms: null }
  const rows = [listing({ id: 'a', price: 150000 }), listing({ id: 'b', price: 9_800_000, currency: 'ALL' }), listing({ id: 'c', price: 90000, city: 'Vlorë' })]
  assert.deepEqual(wantedMatches(want, rows).map((l) => l.id), ['b', 'a'])
  assert.equal(priceInEur({ price: 9_800_000, currency: 'ALL' }), 100000)
  assert.equal(priceInEur({ price: null }), null)
})

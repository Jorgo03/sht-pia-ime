// Form limits are enforced twice: by the forms (src/lib/formLimits.js and the
// limits already in profileForm.js / leads.js) and by the database
// (supabase/migrations/20261104215248_server_form_checks.sql). This keeps the
// two the same, so the server never refuses what a form allowed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { FORM_LIMITS, inIntRange, isValidEmail } from '../src/lib/formLimits.js'
import { PROFILE_LIMITS } from '../src/features/auth/lib/profileForm.js'
import { LEAD_LIMITS } from '../src/features/leads/lib/leads.js'

const sql = fs.readFileSync(new URL('../supabase/migrations/20261104215248_server_form_checks.sql', import.meta.url), 'utf8')

/** The CHECK expression of one constraint in the migration. */
function constraint(name) {
  const m = sql.match(new RegExp(`add constraint ${name}\\s+check \\(([\\s\\S]*?)\\)(,\\n|;\\n)`))
  assert.ok(m, `constraint ${name} is in the migration`)
  return m[1]
}

test('the database uses the forms\' limits', () => {
  const cases = [
    ['properties_title_check', FORM_LIMITS.listingTitle],
    ['properties_description_length', FORM_LIMITS.listingDescription],
    ['properties_address_length', FORM_LIMITS.listingAddress],
    ['properties_city_length', FORM_LIMITS.city],
    ['properties_price_range', FORM_LIMITS.maxPrice],
    ['properties_contact_email_format', FORM_LIMITS.email],
    ['messages_body_length', FORM_LIMITS.message],
    ['viewings_notes_length', FORM_LIMITS.viewingNotes],
    ['wanted_homes_city_length', FORM_LIMITS.city],
    ['wanted_homes_notes_length', FORM_LIMITS.wantedNotes],
    ['wanted_homes_max_price_range', FORM_LIMITS.maxPrice],
    ['wanted_homes_min_bedrooms_range', FORM_LIMITS.maxBedrooms],
    ['saved_searches_name_length', FORM_LIMITS.savedSearchName],
    ['profiles_full_name_length', PROFILE_LIMITS.full_name],
    ['profiles_agency_name_length', PROFILE_LIMITS.agency_name],
    ['leads_name_length', LEAD_LIMITS.name],
    ['leads_phone_length', LEAD_LIMITS.phone],
    ['leads_email_format', LEAD_LIMITS.email],
    ['leads_notes_length', LEAD_LIMITS.notes],
  ]
  for (const [name, limit] of cases) {
    assert.match(constraint(name), new RegExp(`\\b${limit}\\b`), `${name} uses ${limit}`)
  }
})

test('the listing form\'s number ranges match the database', () => {
  const wizard = fs.readFileSync(new URL('../app/listing/new.tsx', import.meta.url), 'utf8')
  const num = (name) => Number(wizard.match(new RegExp(`const ${name} = (-?[0-9_]+)`))[1].replace(/_/g, ''))
  assert.match(constraint('properties_sqft_range'), new RegExp(`between 1 and ${num('MAX_SQFT')}\\b`))
  assert.match(constraint('properties_beds_range'), new RegExp(`between 0 and ${num('MAX_BEDS')}\\b`))
  assert.match(constraint('properties_baths_range'), new RegExp(`between 0 and ${num('MAX_BATHS')}\\b`))
  assert.match(constraint('properties_floor_range'), new RegExp(`between ${num('MIN_FLOOR')} and ${num('MAX_FLOOR')}\\b`))
  assert.match(constraint('properties_total_floors_range'), new RegExp(`between 1 and ${num('MAX_FLOOR')}\\b`))
  assert.match(constraint('properties_year_built_range'), new RegExp(`between ${num('MIN_YEAR')} and`))
  assert.equal(num('MAX_PRICE'), FORM_LIMITS.maxPrice)
})

test('email: empty or plausible, as the database checks', () => {
  assert.equal(isValidEmail(''), true)
  assert.equal(isValidEmail('  '), true)
  assert.equal(isValidEmail('ana@example.com'), true)
  assert.equal(isValidEmail('ana@example'), false)
  assert.equal(isValidEmail('ana example.com'), false)
  assert.equal(isValidEmail(`${'a'.repeat(250)}@x.com`), false)
})

test('whole-number ranges: empty passes, out of range or not whole fails', () => {
  assert.equal(inIntRange('', 1, 10), true)
  assert.equal(inIntRange('5', 1, 10), true)
  assert.equal(inIntRange('0', 1, 10), false)
  assert.equal(inIntRange('11', 1, 10), false)
  assert.equal(inIntRange('2.5', 1, 10), false)
  assert.equal(inIntRange('abc', 1, 10), false)
})

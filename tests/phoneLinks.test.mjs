import { test } from 'node:test'
import assert from 'node:assert/strict'
import { telUrl, whatsappUrl } from '../src/lib/format.js'

// Bugs found by /replica-test, 2026-10-14 (replica/bugs.md BUG-003, BUG-007,
// BUG-011).
// wa.me needs the full international number as digits only: no '+', no
// leading 0, and the right country code. Phones in the live database come in
// all of these shapes.

const number = (url) => new URL(url).pathname.slice(1)

test('Albanian international format loses the + and spaces', () => {
  assert.equal(number(whatsappUrl('+355 69 123 4567', 'hi')), '355691234567')
})

test('Albanian local format gets the country code instead of the 0', () => {
  assert.equal(number(whatsappUrl('0692123456', 'hi')), '355692123456')
  assert.equal(number(whatsappUrl('+ 069 23 22 758', 'hi')), '355692322758')
})

test('a bare national number without 0 gets the Albanian code', () => {
  assert.equal(number(whatsappUrl('69 602 0791', 'hi')), '355696020791')
})

test('a foreign number written with + keeps its own country code', () => {
  assert.equal(number(whatsappUrl('+39 333 123 4567', 'hi')), '393331234567')
  assert.equal(number(whatsappUrl('+49 151 23456789', 'hi')), '4915123456789')
})

test('a foreign number written with 00 keeps its own country code', () => {
  assert.equal(number(whatsappUrl('0039 333 123 4567', 'hi')), '393331234567')
  assert.equal(number(whatsappUrl('00355 69 123 4567', 'hi')), '355691234567')
})

test('the message is URL-encoded', () => {
  assert.equal(new URL(whatsappUrl('0692123456', 'Përshëndetje & "2+1"')).searchParams.get('text'), 'Përshëndetje & "2+1"')
})

test('the call link uses the same cleaned international number', () => {
  assert.equal(telUrl('+ 069 23 22 758'), 'tel:+355692322758')
  assert.equal(telUrl('0692123456'), 'tel:+355692123456')
  assert.equal(telUrl('+39 333 123 4567'), 'tel:+393331234567')
})

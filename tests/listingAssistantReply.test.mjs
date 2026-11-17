// The listing assistant's "I don't know, here is the seller" signal
// (supabase/functions/ai-listing-assistant/reply.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CONTACT_MARKER, CONTACT_RULE, parseReply } from '../supabase/functions/ai-listing-assistant/reply.js'

test('an answer from the data shows no contact', () => {
  assert.deepEqual(parseReply('Ka 2 dhoma gjumi dhe 1 banjo.'), { reply: 'Ka 2 dhoma gjumi dhe 1 banjo.', contact: false })
})

test('the marker is removed and asks for the contact', () => {
  assert.deepEqual(parseReply(`Shpallja nuk e thotë nëse ka parkim. ${CONTACT_MARKER}`), {
    reply: 'Shpallja nuk e thotë nëse ka parkim.',
    contact: true,
  })
})

test('the marker anywhere, or more than once, is never shown', () => {
  const { reply, contact } = parseReply(`${CONTACT_MARKER}Nuk e di.\n${CONTACT_MARKER}`)
  assert.equal(contact, true)
  assert.equal(reply.includes('[['), false)
  assert.equal(reply, 'Nuk e di.')
})

test('a reply that is only the marker still asks for the contact', () => {
  assert.deepEqual(parseReply(CONTACT_MARKER), { reply: '', contact: true })
})

test('a missing reply is empty, not a crash', () => {
  assert.deepEqual(parseReply(undefined), { reply: '', contact: false })
})

test('the prompt rule names the same marker the parser removes', () => {
  assert.ok(CONTACT_RULE.includes(CONTACT_MARKER))
})

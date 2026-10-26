import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ASSISTANT_HISTORY_LIMIT, assistantHistory } from '../src/features/properties/lib/assistantHistory.js'

// What the listing assistant is sent. The function keeps the last 10
// messages, and the first one must be the person's.

const chat = (pairs) =>
  Array.from({ length: pairs }, (_, i) => [
    { role: 'user', content: `q${i + 1}` },
    { role: 'assistant', content: `a${i + 1}` },
  ]).flat()

// What the function does with what it receives (index.ts): the last 10.
const serverKeeps = (history) => history.slice(-10)

test('the sixth question and later still start with a question, after the server cuts', () => {
  for (let pairs = 0; pairs <= 12; pairs++) {
    const sent = serverKeeps(assistantHistory(chat(pairs), 'new question'))
    assert.equal(sent[0].role, 'user', `${pairs} earlier exchanges`)
    assert.equal(sent.at(-1).content, 'new question')
    assert.ok(sent.length <= ASSISTANT_HISTORY_LIMIT)
  }
})

test('the old way broke from the sixth question: 11 messages cut to 10 start with an answer', () => {
  const whole = [...chat(5), { role: 'user', content: 'q6' }]
  assert.equal(serverKeeps(whole)[0].role, 'assistant')
})

test('a failed reply and the question it failed on are left out', () => {
  const messages = [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: 'q2' },
    { role: 'assistant', content: 'The assistant is unavailable', failed: true },
  ]
  assert.deepEqual(assistantHistory(messages, 'q3'), [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'a1' },
    { role: 'user', content: 'q3' },
  ])
})

test('only role and content are sent, and empty or unknown entries are dropped', () => {
  const messages = [{ role: 'user', content: 'q1', extra: 1 }, { role: 'system', content: 'x' }, { role: 'assistant', content: '' }]
  assert.deepEqual(assistantHistory(messages, 'q2'), [
    { role: 'user', content: 'q1' },
    { role: 'user', content: 'q2' },
  ])
  assert.deepEqual(assistantHistory(undefined, 'q'), [{ role: 'user', content: 'q' }])
})

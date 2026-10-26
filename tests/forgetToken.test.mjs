import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forgetToken } from '../src/features/notifications/lib/forgetToken.js'

// Sign-out must not forget the device's push token before the server has.

const run = ({ token = 'ExponentPushToken[x]', results }) => {
  const calls = { deletes: 0, cleared: 0 }
  const queue = [...results]
  return forgetToken({
    readToken: async () => token,
    deleteRow: async () => {
      calls.deletes++
      const r = queue.shift()
      if (r === 'throw') throw new Error('offline')
      return r
    },
    clearToken: async () => { calls.cleared++ },
    wait: async () => {},
  }).then((outcome) => ({ outcome, ...calls }))
}

test('a deleted row clears the record', async () => {
  assert.deepEqual(await run({ results: [{ error: null }] }), { outcome: 'removed', deletes: 1, cleared: 1 })
})

test('a refused delete ({ error }, not a throw) keeps the record after one retry', async () => {
  assert.deepEqual(await run({ results: [{ error: { message: 'x' } }, { error: { message: 'x' } }] }), { outcome: 'kept', deletes: 2, cleared: 0 })
})

test('offline then back: the retry deletes and clears', async () => {
  assert.deepEqual(await run({ results: ['throw', { error: null }] }), { outcome: 'removed', deletes: 2, cleared: 1 })
})

test('nothing registered: nothing sent', async () => {
  assert.deepEqual(await run({ token: null, results: [] }), { outcome: 'none', deletes: 0, cleared: 0 })
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPreferences, savePreferences } from '../src/features/notifications/lib/preferences.js'

// Notification preferences (docs/LAUNCH_TASKS.md F14): no row or an error
// means "on" (matching the database trigger), saving never sends a user id.

const client = (result, calls = []) => ({
  calls,
  from: (t) => {
    const q = {
      select: () => q, eq: () => q, maybeSingle: async () => result,
      upsert: async (row, opts) => { calls.push([t, row, opts]); return result },
    }
    return q
  },
})

test('nothing saved, or a failed read, means both are on', async () => {
  assert.deepEqual(await loadPreferences(client({ data: null, error: null }), 'u'), { messages: true, viewings: true })
  assert.deepEqual(await loadPreferences(client({ data: null, error: { code: 'x' } }), 'u'), { messages: true, viewings: true })
  assert.deepEqual(await loadPreferences({ from() { throw new Error('offline') } }, 'u'), { messages: true, viewings: true })
})

test('saved choices are read back', async () => {
  assert.deepEqual(await loadPreferences(client({ data: { messages: false, viewings: true }, error: null }), 'u'), { messages: false, viewings: true })
})

test('saving sends only the two switches; the server fills in who', async () => {
  const c = client({ error: null })
  assert.equal(await savePreferences(c, { messages: 0, viewings: 'yes' }), true)
  assert.deepEqual(c.calls, [['notification_preferences', { messages: false, viewings: true }, { onConflict: 'user_id' }]])
  assert.equal(await savePreferences(client({ error: { code: '42501' } }), { messages: true, viewings: true }), false)
})

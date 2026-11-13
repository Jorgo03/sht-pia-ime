import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// AUDIT-007: deleting an account removes the person's conversations (they
// cascade with the profile), but the chat photos and documents in the private
// message-attachments bucket were left behind. Files are stored per
// conversation (<conversation_id>/<file>), not per user, so the function has
// to find the conversations before they are gone and empty those folders.

const src = fs.readFileSync(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8')

test('the function looks up the account\'s conversations, as client or agent', () => {
  assert.match(src, /for \(const side of \['client_id', 'agent_id'\]\)/)
  assert.match(src, /\.from\('conversations'\)\.select\('id'\)\.eq\(side, uid\)/)
})

test('it empties each conversation folder in message-attachments', () => {
  assert.match(src, /'message-attachments'/)
  assert.match(src, /purgeFolder\('message-attachments', c\.id\)/)
})

test('attachments go before the auth user is deleted (after that the conversations are gone)', () => {
  const purge = src.indexOf("purgeFolder('message-attachments'")
  const del = src.indexOf('admin.auth.admin.deleteUser(uid)')
  assert.ok(purge > 0 && del > 0 && purge < del)
})

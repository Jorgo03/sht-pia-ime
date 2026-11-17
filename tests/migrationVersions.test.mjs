import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// AUDIT-012: a migration file's version must be the version the live database
// recorded, or `supabase migration list` / `db push` report drift.
// server_form_checks was applied live as 20261104215248 (list_migrations,
// 2026-11-13) but the file said 20261104210000.

const files = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql'))

test('server_form_checks carries its live version', () => {
  assert.deepEqual(files.filter((f) => f.endsWith('_server_form_checks.sql')), ['20261104215248_server_form_checks.sql'])
})

test('every migration file has a unique 14-digit version', () => {
  const versions = files.map((f) => f.split('_')[0])
  for (const v of versions) assert.match(v, /^\d{14}$/)
  assert.equal(new Set(versions).size, versions.length)
})

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

// REGISTRATION_FAILURE_AUDIT.md RC4, offline in PGlite like the other
// supabase/tests_*.test.mjs files. A stand-in auth.users and the live
// profiles constraints (read 2026-11-18); the sign-up trigger must never
// abort a registration, whatever the sign-up metadata holds.
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

const SCHEMA = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text, avatar_url text,
    role text not null default 'buyer',
    agency_name text,
    preferred_language text not null default 'sq',
    created_at timestamptz not null default now(),
    constraint profiles_role_check check (role = any (array['buyer','agent'])),
    constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 80),
    constraint profiles_agency_name_length check (agency_name is null or char_length(agency_name) <= 80),
    constraint profiles_preferred_language_check check (preferred_language = any (array['sq','en','de','it','es','pl','ru','fr']))
  );`;
const TRIGGER = `create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();`;

async function dbWith(migration) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(read(migration));
  await db.exec(TRIGGER);
  return db;
}

const signUp = (db, id, meta) =>
  db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)', [id, JSON.stringify(meta)]);
const profile = async (db, id) => (await db.query('select * from public.profiles where id = $1', [id])).rows[0];

const LONG = 'A'.repeat(81);
const ID = '00000000-0000-4000-8000-000000000001';

test('before the fix: an 81-character office aborts the whole sign-up', async () => {
  const db = await dbWith('./migrations/20260903213714_handle_new_user_cannot_abort_signup.sql');
  await assert.rejects(signUp(db, ID, { role: 'agent', full_name: 'Ana', agency_name: LONG }), /profiles_agency_name_length/);
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 0, 'no account at all');
});

test('a long name or office is trimmed, the account and profile are created', async () => {
  const db = await dbWith('./migrations/20261118001327_handle_new_user_trims_lengths.sql');
  await signUp(db, ID, { role: 'agent', full_name: `  ${LONG}  `, agency_name: LONG });
  const p = await profile(db, ID);
  assert.equal(p.full_name.length, 80);
  assert.equal(p.agency_name.length, 80);
  assert.equal(p.role, 'agent');
});

test('the role is agent only when asked for, and a buyer never keeps an office', async () => {
  const db = await dbWith('./migrations/20261118001327_handle_new_user_trims_lengths.sql');
  const ids = ['01', '02', '03', '04'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
  await signUp(db, ids[0], { role: 'buyer', full_name: 'Ana', agency_name: 'Zyra' });
  await signUp(db, ids[1], { role: 'admin', full_name: 'Eve' });
  await signUp(db, ids[2], { role: 'agent', full_name: 'Ben', agency_name: '   ' });
  await signUp(db, ids[3], { name: 'Google Name', preferred_language: 'en-US' });
  assert.deepEqual(
    (await Promise.all(ids.map((id) => profile(db, id)))).map((p) => [p.role, p.agency_name, p.full_name, p.preferred_language]),
    [
      ['buyer', null, 'Ana', 'sq'],
      ['buyer', null, 'Eve', 'sq'],
      ['agent', null, 'Ben', 'sq'],
      ['buyer', null, 'Google Name', 'sq'],
    ],
  );
});

test('an existing profile is left alone', async () => {
  const db = await dbWith('./migrations/20261118001327_handle_new_user_trims_lengths.sql');
  await db.exec(`alter table public.profiles drop constraint profiles_id_fkey`);
  await db.query(`insert into public.profiles (id, full_name, role) values ($1, 'Kept', 'agent')`, [ID]);
  await signUp(db, ID, { role: 'buyer', full_name: 'New' });
  const p = await profile(db, ID);
  assert.deepEqual([p.full_name, p.role], ['Kept', 'agent']);
});

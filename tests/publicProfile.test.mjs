// Public profile rules (src/features/profiles/lib/publicProfile.js): whose
// profile the chat opens, what the card shows, and which listings are asked for.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROFILE_PAGE_SIZE,
  fetchPublicProfile,
  fetchPublisherListings,
  isUserId,
  otherParticipant,
  profileInitials,
  publicProfileView,
} from '../src/features/profiles/lib/publicProfile.js'

const ME = '11111111-1111-4111-8111-111111111111'
const THEM = '22222222-2222-4222-8222-222222222222'

test('the chat opens the other participant, never the viewer', () => {
  assert.equal(otherParticipant({ client_id: ME, agent_id: THEM }, ME), THEM)
  assert.equal(otherParticipant({ client_id: THEM, agent_id: ME }, ME), THEM)
  // Not in the conversation, a conversation with oneself, or nothing loaded.
  assert.equal(otherParticipant({ client_id: THEM, agent_id: THEM }, ME), null)
  assert.equal(otherParticipant({ client_id: ME, agent_id: ME }, ME), null)
  assert.equal(otherParticipant(null, ME), null)
  assert.equal(otherParticipant({ client_id: ME, agent_id: THEM }, null), null)
})

test('only a real user id reaches a query', () => {
  assert.equal(isUserId(THEM), true)
  for (const bad of ['', 'abc', `${THEM},agent_id.neq.x`, `${THEM})`, null, undefined, 42]) {
    assert.equal(isUserId(bad), false, String(bad))
  }
})

test('an agent card shows the office; a client card never does', () => {
  const agent = publicProfileView({ id: THEM, kind: 'agent', full_name: ' Evi Hoxha ', avatar_url: 'https://x/a.jpg', phone: '+355 69 000 0001', agency_name: 'Zyra Evi', listing_count: '3' })
  assert.deepEqual(agent, { id: THEM, kind: 'agent', name: 'Evi Hoxha', avatarUrl: 'https://x/a.jpg', phone: '+355 69 000 0001', office: 'Zyra Evi', listingCount: 3 })
  const client = publicProfileView({ id: THEM, kind: 'client', full_name: 'Ana', avatar_url: null, phone: null, agency_name: 'Should not show', listing_count: 0 })
  assert.equal(client.office, null)
  assert.equal(client.kind, 'client')
  assert.equal(client.phone, null)
  assert.equal(publicProfileView(null), null)
  // An unknown kind is treated as a client (no office), blanks as missing.
  const odd = publicProfileView({ id: THEM, kind: 'admin', full_name: '   ', agency_name: 'X', listing_count: -2 })
  assert.equal(odd.kind, 'client')
  assert.equal(odd.office, null)
  assert.equal(odd.name, null)
  assert.equal(odd.listingCount, 0)
})

test('initials for the avatar placeholder', () => {
  assert.equal(profileInitials('evi'), 'E')
  assert.equal(profileInitials('Evi Hoxha'), 'EH')
  assert.equal(profileInitials('  ana  maria  kola '), 'AK')
  assert.equal(profileInitials('Ëngjëll Çela'), 'ËÇ')
  assert.equal(profileInitials(''), '?')
  assert.equal(profileInitials(null), '?')
})

function fakeClient(result, tableResults = []) {
  const calls = []
  const query = {
    select: (...a) => (calls.push(['select', ...a]), query),
    or: (...a) => (calls.push(['or', ...a]), query),
    eq: (...a) => (calls.push(['eq', ...a]), query),
    order: (...a) => (calls.push(['order', ...a]), query),
    range: (...a) => (calls.push(['range', ...a]), Promise.resolve(result)),
    maybeSingle: () => (calls.push(['maybeSingle']), Promise.resolve(tableResults.shift())),
  }
  return {
    calls,
    from: (table) => (calls.push(['from', table]), query),
    rpc: (name, args) => (calls.push(['rpc', name, args]), Promise.resolve(result)),
  }
}

test('before the migration: the profile row as today, agents and allowed clients only', async () => {
  const missing = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
  // Signed in: the role decides the kind.
  const signedIn = fakeClient(missing, [{ data: { id: THEM, full_name: 'Ana', role: 'buyer', agency_name: 'X' }, error: null }])
  const client = await fetchPublicProfile(signedIn, THEM)
  assert.equal(client.kind, 'client')
  assert.equal(publicProfileView(client).office, null)
  // Signed out: `role` is not readable, and only agents are visible.
  const signedOut = fakeClient(missing, [
    { data: null, error: { code: '42501', message: 'permission denied for column role' } },
    { data: { id: THEM, full_name: 'Evi', agency_name: 'Zyra' }, error: null },
  ])
  const agent = await fetchPublicProfile(signedOut, THEM)
  assert.equal(agent.kind, 'agent')
  assert.equal(publicProfileView(agent).office, 'Zyra')
  // Not visible: no profile, not an error.
  assert.equal(await fetchPublicProfile(fakeClient(missing, [{ data: null, error: null }]), THEM), null)
})

test('listings: this person as publisher, active only, 24 per page', async () => {
  const client = fakeClient({ data: [{ id: 'a' }], error: null, count: 30 })
  const page = await fetchPublisherListings(client, THEM, 1)
  assert.deepEqual(page, { rows: [{ id: 'a' }], total: 30 })
  assert.deepEqual(client.calls, [
    ['from', 'properties'],
    ['select', '*', { count: 'exact' }],
    ['or', `owner_id.eq.${THEM},agent_id.eq.${THEM}`],
    ['eq', 'status', 'active'],
    ['order', 'created_at', { ascending: false }],
    ['range', PROFILE_PAGE_SIZE, 2 * PROFILE_PAGE_SIZE - 1],
  ])
  assert.equal(PROFILE_PAGE_SIZE, 24)
})

test('listings: a bad id asks nothing, and a failure is an error, not "none"', async () => {
  const unused = fakeClient({ data: [], error: null })
  assert.deepEqual(await fetchPublisherListings(unused, 'not-an-id'), { rows: [], total: 0 })
  assert.deepEqual(unused.calls, [])
  const failing = fakeClient({ data: null, error: new Error('offline') })
  await assert.rejects(fetchPublisherListings(failing, THEM), /offline/)
})

test('the card comes from public_profile for that id; none is null', async () => {
  const client = fakeClient({ data: [{ id: THEM, kind: 'client' }], error: null })
  assert.deepEqual(await fetchPublicProfile(client, THEM), { id: THEM, kind: 'client' })
  assert.deepEqual(client.calls, [['rpc', 'public_profile', { p_user: THEM }]])
  assert.equal(await fetchPublicProfile(fakeClient({ data: [], error: null }), THEM), null)
  const bad = fakeClient({ data: [], error: null })
  assert.equal(await fetchPublicProfile(bad, 'x'), null)
  assert.deepEqual(bad.calls, [])
  await assert.rejects(fetchPublicProfile(fakeClient({ data: null, error: new Error('down') }), THEM), /down/)
})

// The simulator's pretend Supabase (simulator/demo-backend.js): the PostgREST
// subset the app uses, sign-in with the demo accounts, and the privacy rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Buffer } from 'node:buffer';

const ctx = { console, URL, URLSearchParams, setTimeout, clearTimeout, Buffer };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['simulator/seed.js', 'simulator/demo-backend.js']) {
  vm.runInContext(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
}
const { createBackend, splitTop, parseSelect } = ctx.SimulatorBackend;
const seed = ctx.SIM_SEED;
const BASE = 'https://demo.supabase.co';

function setup() {
  const be = createBackend({ seed });
  const call = (method, path, { body, token, accept, prefer } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (accept) headers.accept = accept;
    if (prefer) headers.prefer = prefer;
    const res = be.handle({ url: BASE + path, method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return JSON.parse(JSON.stringify(res));
  };
  const login = (email) => call('POST', '/auth/v1/token?grant_type=password', { body: { email, password: 'demo1234' } }).body.access_token;
  return { be, call, login };
}

test('splitTop and parseSelect read nested PostgREST syntax', () => {
  assert.deepEqual([...splitTop('a.eq.1,and(b.gt.2,c.lt.3),d.is.null')], ['a.eq.1', 'and(b.gt.2,c.lt.3)', 'd.is.null']);
  const sel = parseSelect('*, agent:profiles(id, full_name), property:properties!viewings_property_id_fkey(id, title)');
  assert.deepEqual([...sel.columns], ['*']);
  assert.deepEqual([...sel.embeds].map((e) => [e.alias, e.table]), [['agent', 'profiles'], ['property', 'properties']]);
});

test('anonymous visitors see only active listings, filtered, ordered and paged', () => {
  const { call } = setup();
  const all = call('GET', '/rest/v1/properties?select=*&order=price.desc', { prefer: 'count=exact' });
  assert.equal(all.status, 200);
  assert.ok(all.body.every((p) => p.status === 'active'));
  assert.match(all.headers['content-range'], /^0-\d+\/\d+$/);
  const prices = all.body.map((p) => Number(p.price));
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));

  const rent = call('GET', '/rest/v1/properties?select=id,listing_type,city&listing_type=eq.rent&city=ilike.*tiran*&offset=0&limit=2');
  assert.equal(rent.body.length, 2);
  assert.ok(rent.body.every((p) => p.listing_type === 'rent' && Object.keys(p).length === 3));

  const or = call('GET', `/rest/v1/properties?select=id,title&or=${encodeURIComponent('(title.ilike.*vilë*,zone.ilike.*plazh*)')}`);
  assert.ok(or.body.length >= 3);
  assert.ok(or.body.every((p) => /vilë|plazh/i.test(p.title)));
});

test('embeds follow <alias>_id and single-object requests return 406 on no row', () => {
  const { call } = setup();
  const id = seed.tables.properties[0].id;
  const one = call('GET', `/rest/v1/properties?select=*,agent:profiles(id,full_name)&id=eq.${id}`, { accept: 'application/vnd.pgrst.object+json' });
  assert.equal(one.status, 200);
  assert.equal(one.body.agent.full_name, 'Elira Kola');
  assert.deepEqual(Object.keys(one.body.agent), ['id', 'full_name']);
  const none = call('GET', '/rest/v1/properties?select=*&id=eq.nope', { accept: 'application/vnd.pgrst.object+json' });
  assert.equal(none.status, 406);
});

test('sign-in, wrong password and email code', () => {
  const { call } = setup();
  assert.equal(call('POST', '/auth/v1/token?grant_type=password', { body: { email: 'agjent@demo.al', password: 'x' } }).status, 400);
  const ok = call('POST', '/auth/v1/token?grant_type=password', { body: { email: 'AGJENT@demo.al', password: 'demo1234' } });
  assert.equal(ok.status, 200);
  const me = call('GET', '/auth/v1/user', { token: ok.body.access_token });
  assert.equal(me.body.email, 'agjent@demo.al');
  assert.equal(call('POST', '/auth/v1/verify', { body: { email: 'new@demo.al', token: '000000', type: 'email' } }).status, 403);
  assert.equal(call('POST', '/auth/v1/verify', { body: { email: 'new@demo.al', token: '123456', type: 'email' } }).status, 200);
});

test('privacy: leads, messages and other agents’ listings stay with their owner', () => {
  const { call, login } = setup();
  const agent = login('agjent@demo.al');
  const client = login('klient@demo.al');
  assert.equal(call('GET', '/rest/v1/leads?select=*', { token: agent }).body.length, 4);
  assert.equal(call('GET', '/rest/v1/leads?select=*', { token: client }).body.length, 0);
  assert.equal(call('GET', '/rest/v1/leads?select=*').body.length, 0);

  const paused = seed.tables.properties.find((p) => p.status === 'paused');
  assert.equal(call('GET', `/rest/v1/properties?select=id&id=eq.${paused.id}`, { token: client }).body.length, 0);
  assert.equal(call('GET', `/rest/v1/properties?select=id&id=eq.${paused.id}`, { token: agent }).body.length, 1);

  const other = seed.tables.properties.find((p) => p.agent_id === seed.ids.agent2);
  call('PATCH', `/rest/v1/properties?id=eq.${other.id}`, { token: agent, body: { price: 1 } });
  assert.notEqual(call('GET', `/rest/v1/properties?select=price&id=eq.${other.id}`).body[0].price, 1);

  const msgs = call('GET', '/rest/v1/messages?select=*', { token: client }).body;
  assert.ok(msgs.length > 0);
  const mine = new Set(seed.tables.conversations.filter((c) => c.client_id === seed.ids.client).map((c) => c.id));
  assert.ok(msgs.every((m) => mine.has(m.conversation_id)));
});

test('writes: insert with defaults, duplicate favourite, update and delete', () => {
  const { call, login } = setup();
  const agent = login('agjent@demo.al');
  const added = call('POST', '/rest/v1/leads?select=*', { token: agent, prefer: 'return=representation', body: { name: 'Test Lead', phone: '069 000 0000', email: null, notes: null, status: 'new' } });
  assert.equal(added.status, 201);
  assert.equal(added.body[0].agent_id, seed.ids.agent);
  assert.ok(added.body[0].id);

  const client = login('klient@demo.al');
  const fav = { user_id: seed.ids.client, property_id: seed.tables.properties[1].id };
  assert.equal(call('POST', '/rest/v1/favorites', { token: client, body: fav }).status, 409);

  call('PATCH', `/rest/v1/leads?id=eq.${added.body[0].id}`, { token: agent, body: { status: 'won' } });
  assert.equal(call('GET', `/rest/v1/leads?select=status&id=eq.${added.body[0].id}`, { token: agent }).body[0].status, 'won');
  call('DELETE', `/rest/v1/leads?id=eq.${added.body[0].id}`, { token: agent });
  assert.equal(call('GET', '/rest/v1/leads?select=id', { token: agent }).body.length, 4);
});

test('a new message bumps the conversation for the other side', () => {
  const { call, login } = setup();
  const client = login('klient@demo.al');
  const conv = seed.tables.conversations[0];
  call('POST', '/rest/v1/messages', { token: client, body: { conversation_id: conv.id, sender_id: seed.ids.client, body: 'Faleminderit!' } });
  const agent = login('agjent@demo.al');
  const c = call('GET', `/rest/v1/conversations?select=*&id=eq.${conv.id}`, { token: agent }).body[0];
  assert.equal(c.unread_for_agent, conv.unread_for_agent + 1);
});

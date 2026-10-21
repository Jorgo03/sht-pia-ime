import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
// Prepaid checkout (docs/LAUNCH_TASKS.md F15), offline in PGlite with a small
// Supabase stand-in; never touches a real database.
// Run: npm install --no-save @electric-sql/pglite@0.2.17
//      node supabase/tests_prepaid_checkout.test.mjs
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const db = new PGlite();
const AGENT = '11111111-1111-1111-1111-111111111111';
const CLIENT = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
const L1 = 'aaaaaaaa-0000-0000-0000-000000000001'; // client's listing
const L2 = 'aaaaaaaa-0000-0000-0000-000000000002'; // other's listing

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create function public.handle_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
  insert into auth.users values ('${AGENT}'), ('${CLIENT}'), ('${OTHER}');
  create table public.profiles (id uuid primary key, role text);
  create table public.properties (id uuid primary key default gen_random_uuid(), owner_id uuid, agent_id uuid, title text,
    status text default 'active', updated_at timestamptz default now());
  alter table public.properties enable row level security;
  create policy p_sel on public.properties for select using (true);
  create policy p_ins on public.properties for insert with check ((select auth.uid()) = owner_id);
  create policy p_upd on public.properties for update using ((select auth.uid()) = owner_id);
  insert into public.profiles values ('${AGENT}','agent'), ('${CLIENT}','buyer'), ('${OTHER}','buyer');
  insert into public.properties (id, owner_id, title) values ('${L1}','${CLIENT}','Client home'), ('${L2}','${OTHER}','Other home');
`);
await db.exec(read('./migrations/20261014214726_add_payments_foundation.sql'));
await db.exec(read('./pending/plans_by_period_months.sql'));
await db.exec(read('./pending/prepaid_checkout.sql'));
await db.exec(`
  insert into public.plans (id, kind, tier, period_months, price_cents, currency, listing_cap) values
    ('pro_1','agency_subscription','pro',1,2490,'ALL',2),
    ('pro_12','agency_subscription','pro',12,24900,'ALL',2),
    ('promote_1','promotion','promote',1,500,'EUR',null);
  insert into public.plans (id, kind, tier, period_months, price_cents, active) values ('old','promotion','promote',3,100,false);
`);

let pass = 0, fail = 0;
const as = async (role, uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, n: r.affectedRows }; }
  catch (e) { return { ok: false, err: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
};
const check = (name, cond, info) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + JSON.stringify(info)}`); };
const one = async (sql) => (await db.query(sql)).rows[0];
const activate = (order, amount, currency, event) =>
  as('service_role', null, `select public.activate_paid_order('${order}', ${amount}, '${currency}', 'paysera', '${event}', '{}') r`);
const months = (a, b) => Math.round((new Date(b) - new Date(a)) / (30.44 * 864e5));
let r;

// Starting a checkout
r = await as('authenticated', CLIENT, `select public.create_checkout_order('pro_1') id`);
check('a client cannot buy an agency plan', !r.ok && r.code === '42501', r);
r = await as('authenticated', AGENT, `select public.create_checkout_order('pro_1') id`);
check('an agent starts an agency checkout', r.ok, r);
const order1 = r.rows?.[0]?.id;
let o = await one(`select amount_cents, currency, period_months, status from public.checkout_orders where id = '${order1}'`);
check('price, currency and period come from the plan, not the client', o.amount_cents === 2490 && o.currency === 'ALL' && o.period_months === 1 && o.status === 'created', o);
r = await as('authenticated', AGENT, `select public.create_checkout_order('old') id`);
check('an inactive plan cannot be bought', !r.ok && r.code === '22023', r);
r = await as('authenticated', CLIENT, `select public.create_checkout_order('promote_1', '${L2}') id`);
check("nobody can promote someone else's listing", !r.ok && r.code === '42501', r);
r = await as('authenticated', CLIENT, `select public.create_checkout_order('promote_1', '${L1}') id`);
check('a client can promote their own listing', r.ok, r);
const promoOrder = r.rows?.[0]?.id;
r = await as('authenticated', CLIENT, `insert into public.checkout_orders (user_id, plan_id, period_months, amount_cents, currency) values ('${CLIENT}','promote_1',1,0,'EUR')`);
check('orders cannot be written directly', !r.ok, r);
r = await as('authenticated', CLIENT, `update public.checkout_orders set status='paid'`);
check('a buyer cannot mark an order paid', !r.ok || r.n === 0, r);
r = await as('authenticated', OTHER, `select count(*)::int c from public.checkout_orders`);
check("orders are private to the buyer", r.ok && r.rows[0].c === 0, r);
r = await as('authenticated', AGENT, `select public.activate_paid_order('${order1}', 2490, 'ALL', 'paysera', 'evt-x', '{}')`);
check('apps cannot call the activation function', !r.ok && r.code === '42501', r);

// Activation
r = await activate(order1, 999, 'ALL', 'evt-mismatch');
check('a wrong amount grants nothing', r.ok && r.rows[0].r === 'amount_mismatch', r);
check('...and the order stays unpaid', (await one(`select status from public.checkout_orders where id='${order1}'`)).status === 'created');
r = await activate(order1, 2490, 'ALL', 'evt-1');
check('a verified payment activates the plan', r.ok && r.rows[0].r === 'activated', r);
let sub = await one(`select status, cancel_at_period_end, current_period_end from public.agency_subscriptions where agent_id='${AGENT}'`);
check('one prepaid month, never auto-renewing', sub.status === 'active' && sub.cancel_at_period_end === true && months(new Date(), sub.current_period_end) === 1, sub);
r = await activate(order1, 2490, 'ALL', 'evt-1');
check('the same callback again is a no-op', r.ok && r.rows[0].r === 'duplicate', r);
r = await activate(order1, 2490, 'ALL', 'evt-1b');
check('a second event for a paid order is a no-op', r.ok && r.rows[0].r === 'already_processed', r);

// Stacking
r = await as('authenticated', AGENT, `select public.create_checkout_order('pro_12') id`);
const order12 = r.rows[0].id;
const before = sub.current_period_end;
await activate(order12, 24900, 'all', 'evt-2');
sub = await one(`select current_period_end from public.agency_subscriptions where agent_id='${AGENT}'`);
check('buying 12 months while 1 is left gives 13', months(before, sub.current_period_end) === 12 && months(new Date(), sub.current_period_end) === 13, sub);

// Promotion
r = await activate(promoOrder, 500, 'EUR', 'evt-3');
const promo = await one(`select promoted_until from public.properties where id='${L1}'`);
check('a paid promotion sets promoted_until', r.rows[0].r === 'activated' && months(new Date(), promo.promoted_until) === 1, { r, promo });

// Refunds
r = await as('service_role', null, `select public.refund_order('${promoOrder}', 'paysera', 'ref-1') r`);
const after = await one(`select promoted_until from public.properties where id='${L1}'`);
check('refunding the promotion removes it from the listing', r.rows[0].r === 'refunded' && after.promoted_until === null, { r, after });
r = await as('service_role', null, `select public.refund_order('${promoOrder}', 'paysera', 'ref-1') r`);
check('a repeated refund callback is a no-op', r.rows[0].r === 'duplicate', r);
r = await as('service_role', null, `select public.refund_order('${order12}', 'paysera', 'ref-2') r`);
sub = await one(`select status, current_period_end from public.agency_subscriptions where agent_id='${AGENT}'`);
check('refunding 12 months takes 12 months back', r.rows[0].r === 'refunded' && sub.status === 'active' && months(new Date(), sub.current_period_end) === 1, sub);

// Listing caps (plan cap = 2; no free cap set)
const ins = (title, status = 'active') => as('authenticated', AGENT, `insert into public.properties (owner_id, title, status) values ('${AGENT}','${title}','${status}')`);
check('first listing under the plan', (await ins('a1')).ok);
check('second listing under the plan', (await ins('a2')).ok);
r = await ins('a3');
check('a third active listing is refused at the cap', !r.ok && /listing limit reached/.test(r.err), r);
check('a draft is still allowed', (await ins('a4', 'draft')).ok);
r = await as('authenticated', AGENT, `update public.properties set status='active' where title='a4'`);
check('activating the draft is refused at the cap', !r.ok && /listing limit reached/.test(r.err), r);
r = await as('authenticated', CLIENT, `insert into public.properties (owner_id, title) values ('${CLIENT}','c2')`);
check('no free cap set: clients are unaffected', r.ok, r);

// Expiry
await db.exec(`update public.agency_subscriptions set current_period_end = now() - interval '1 day'`);
check('an expired plan stops its cap at once (time-based)', (await ins('a5')).ok);
r = await as('service_role', null, `select public.expire_entitlements() n`);
check('the expiry job marks it canceled', r.ok && (await one(`select status from public.agency_subscriptions where agent_id='${AGENT}'`)).status === 'canceled', r);
await db.exec(`update public.billing_settings set free_listing_cap = 1`);
r = await as('authenticated', CLIENT, `insert into public.properties (owner_id, title) values ('${CLIENT}','c3')`);
check('once the owner sets a free cap it applies to people without a plan', !r.ok && /listing limit reached/.test(r.err), r);

// Rate limit
// The agent has 2 orders so far; 8 more reaches the limit of 10.
for (let i = 0; i < 8; i++) await as('authenticated', AGENT, `select public.create_checkout_order('pro_1')`);
r = await as('authenticated', AGENT, `select public.create_checkout_order('pro_1')`);
check('more than 10 checkouts an hour are refused', !r.ok && r.code === '54000', r);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

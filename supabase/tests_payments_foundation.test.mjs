import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db = new PGlite();
// Usage: npx -y -p @electric-sql/pglite@0.2.17 node supabase/tests_payments_foundation.test.mjs
// Runs the migration in an in-process Postgres with a minimal Supabase stand-in;
// never touches a real database.
const MIG = (process.argv.length > 2 ? process.argv.slice(2).map((p) => new URL(p, 'file://' + process.cwd() + '/')) : [
  new URL('./migrations/20261014214726_add_payments_foundation.sql', import.meta.url),
  new URL('./pending/plans_by_period_months.sql', import.meta.url),
]).map((u) => fs.readFileSync(u, 'utf8')).join('\n');
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
// Minimal stand-in for Supabase: roles, auth.uid(), default grants, the two
// referenced tables and the properties update policy as in production.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create function public.handle_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
  create table public.profiles (id uuid primary key, role text);
  create table public.properties (id uuid primary key default gen_random_uuid(), owner_id uuid, title text, status text default 'active', updated_at timestamptz default now());
  grant all on public.profiles, public.properties to anon, authenticated, service_role;
  alter table public.properties enable row level security;
  create policy "Active properties viewable, owners see own" on public.properties for select using (status = 'active' or (select auth.uid()) = owner_id);
  create policy "Authenticated users can create properties" on public.properties for insert with check ((select auth.uid()) = owner_id);
  create policy "Owners can update own properties" on public.properties for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  insert into public.profiles values ('${A}','agent'),('${B}','buyer');
  insert into public.properties (id, owner_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001','${A}','A home');
`);
await db.exec(MIG);
await db.exec(`insert into public.plans (id, kind, tier, period_months, price_cents) values ('promote_7d','promotion','promote',1,500);
  insert into public.plans (id, kind, tier, period_months, price_cents, listing_cap, promotion_credits) values ('agency_pro','agency_subscription','pro',1,2900,50,3);
  insert into public.plans (id, kind, tier, period_months, price_cents, active) values ('old','promotion','promote',3,100,false);`);

let pass = 0, fail = 0;
const as = async (role, uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, n: r.affectedRows }; }
  catch (e) { return { ok: false, err: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
};
const check = (name, cond, info) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + JSON.stringify(info)}`); };
const P = "'aaaaaaaa-0000-0000-0000-000000000001'";
let r;
r = await as('authenticated', A, `update public.properties set title='Renamed' where id=${P}`); check('owner can still edit their listing', r.ok && r.n === 1, r);
r = await as('authenticated', A, `update public.properties set promoted_until=now()+interval '30 days' where id=${P}`); check('owner CANNOT promote own listing for free', !r.ok && r.code === '42501', r);
r = await as('authenticated', A, `insert into public.properties (owner_id,title,promoted_until) values ('${A}','x',now()+interval '9 days')`); check('cannot insert a pre-promoted listing', !r.ok && r.code === '42501', r);
r = await as('authenticated', A, `update public.properties set title='Again', promoted_until=promoted_until where id=${P}`); check('editing with promoted_until unchanged still works', r.ok && r.n === 1, r);
r = await as('service_role', null, `update public.properties set promoted_until=now()+interval '7 days' where id=${P}`); check('payment server (service_role) can promote', r.ok && r.n === 1, r);
r = await as('authenticated', A, `update public.properties set promoted_until=null where id=${P}`); check('owner cannot clear/alter an active promotion either', !r.ok && r.code === '42501', r);
r = await as('authenticated', A, `insert into public.listing_promotions (property_id,buyer_id,plan_id,starts_at,ends_at,status,provider,provider_ref) values (${P},'${A}','promote_7d',now(),now()+interval '7 days','active','x','fake')`); check('user cannot insert a paid promotion', !r.ok && /row-level security/.test(r.err), r);
r = await as('authenticated', A, `insert into public.agency_subscriptions (agent_id,plan_id,status,current_period_end,provider,provider_ref) values ('${A}','agency_pro','active',now()+interval '1 month','x','fake')`); check('agent cannot grant themselves a plan', !r.ok && /row-level security/.test(r.err), r);
r = await as('service_role', null, `insert into public.agency_subscriptions (agent_id,plan_id,status,current_period_end,provider,provider_ref) values ('${A}','agency_pro','active',now()+interval '1 month','paddle','sub_1')`); check('server can create a subscription', r.ok, r);
r = await as('service_role', null, `insert into public.agency_subscriptions (agent_id,plan_id,status,current_period_end,provider,provider_ref) values ('${A}','agency_pro','active',now()+interval '1 month','paddle','sub_2')`); check('only one live subscription per agent', !r.ok && r.code === '23505', r);
r = await as('authenticated', A, `update public.agency_subscriptions set status='active', current_period_end=now()+interval '10 years'`); check('agent cannot extend their own plan', r.ok && r.n === 0, r);
r = await as('authenticated', A, `select count(*)::int c from public.agency_subscriptions`); check('agent sees their own subscription', r.ok && r.rows[0].c === 1, r);
r = await as('authenticated', B, `select count(*)::int c from public.agency_subscriptions`); check("another user sees none of it", r.ok && r.rows[0].c === 0, r);
r = await as('anon', null, `select string_agg(id, ',' order by id) ids from public.plans`); check('price list is public, inactive plans hidden', r.ok && r.rows[0].ids === 'agency_pro,promote_7d', r);
r = await as('authenticated', A, `insert into public.plans (id,kind,tier,period_months,price_cents) values ('free','promotion','promote',12,0)`); check('users cannot create plans', !r.ok, r);
r = await as('authenticated', A, `update public.plans set price_cents=0`); check('users cannot change prices', r.ok && r.n === 0, r);
r = await as('service_role', null, `insert into public.payment_events (provider,event_id,event_type,payload) values ('paddle','evt_1','paid','{}')`); check('server records an event', r.ok, r);
r = await as('service_role', null, `insert into public.payment_events (provider,event_id,event_type,payload) values ('paddle','evt_1','paid','{}')`); check('a retried event is rejected (idempotency)', !r.ok && r.code === '23505', r);
r = await as('authenticated', A, `select count(*)::int c from public.payment_events`); check('payment events are invisible to users', r.ok && r.rows[0].c === 0, r);
r = await as('service_role', null, `insert into public.plans (id,kind,tier,period_months,price_cents) values ('bad','promotion','promote',2,1)`); check('only 1/3/6/12-month periods allowed', !r.ok && r.code === '23514', r);
r = await as('service_role', null, `insert into public.plans (id,kind,tier,period_months,price_cents) values ('dup','agency_subscription','pro',1,1)`); check('one price per tier and period', !r.ok && r.code === '23505', r);
r = await as('service_role', null, `insert into public.plans (id,kind,tier,period_months,price_cents,listing_cap,promotion_credits) values ('pro_12','agency_subscription','pro',12,29000,50,3)`); check('same tier at another period is fine', r.ok, r);
r = await as('service_role', null, `insert into public.listing_promotions (property_id,buyer_id,plan_id,starts_at,ends_at,provider,provider_ref) values (${P},'${A}','promote_7d',now(),now()-interval '1 day','paddle','o1')`); check('promotion window must end after it starts', !r.ok && r.code === '23514', r);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

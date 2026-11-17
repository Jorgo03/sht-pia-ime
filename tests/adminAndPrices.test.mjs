// Admin actions and prices are decided on the server (AUDIT.md Pass 38).
// A hidden page is not a lock: every moderator action checks is_moderator()
// inside the database, and checkout prices come from public.plans, never from
// what the browser sends. Checked live as an ordinary user in
// supabase/tests/admin_and_prices.sql; this keeps the code that way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const fn = (sql, name) => {
  const start = sql.indexOf(`function public.${name}(`)
  assert.ok(start >= 0, `${name} exists`)
  return sql.slice(start, sql.indexOf('\n$$;', start))
}

test('every moderator action checks the role in the database first', () => {
  const sql = read('supabase/migrations/20261021052850_moderation.sql')
  for (const name of ['moderate_listing', 'resolve_report']) {
    const body = fn(sql, name)
    const begin = body.indexOf('begin')
    assert.match(body.slice(begin, begin + 120), /if not public\.is_moderator\(\) then\s+raise exception/, `${name} checks is_moderator() before anything else`)
  }
  assert.match(sql, /revoke all on function public\.moderate_listing\(uuid, boolean\) from public, anon/)
})

test('the moderation page itself is only a view: the website hides it, the server decides', () => {
  const page = read('app/moderation.web.tsx')
  assert.doesNotMatch(page, /from\('properties'\)\.update|from\('content_reports'\)\.update/, 'no direct writes from the page')
})

test('checkout prices come from the plan list, not the browser', () => {
  const sql = read('supabase/pending/prepaid_checkout.sql')
  const create = fn(sql, 'create_checkout_order')
  assert.match(create, /^function public\.create_checkout_order\(p_plan_id text, p_property_id uuid default null\)/, 'takes only which plan and which listing')
  assert.match(create, /select \* into plan from public\.plans where id = p_plan_id and active/)
  assert.match(create, /values \(uid, plan\.id, p_property_id, plan\.period_months, plan\.price_cents, plan\.currency\)/, 'amount, currency and period copied from the plan')
  assert.match(create, /role = 'agent'/, 'agency plans need the agent role, checked on the server')
  assert.match(create, /p\.owner_id = uid or p\.agent_id = uid/, 'promotions only for your own listing')
  assert.match(sql, /revoke insert, update, delete on public\.checkout_orders from anon, authenticated/)

  const start = read('supabase/functions/checkout-start/index.ts')
  const rpc = start.match(/rpc\('create_checkout_order', \{([\s\S]*?)\}\)/)[1]
  assert.deepEqual([...rpc.matchAll(/(p_[a-z_]+):/g)].map((m) => m[1]), ['p_plan_id', 'p_property_id'])
  assert.doesNotMatch(start, /body\.(amount|price|total|currency)/, 'nothing about money is read from the request')
})

test('a payment only counts if it matches the order, and only the server can record one', () => {
  const sql = read('supabase/pending/prepaid_checkout.sql')
  const activate = fn(sql, 'activate_paid_order')
  assert.match(activate, /o\.amount_cents <> p_amount_cents or o\.currency <> upper\(p_currency\)/)
  assert.match(activate, /return 'amount_mismatch'/)
  assert.match(activate, /on conflict do nothing;\s+if not found then return 'duplicate'/, 'a replayed payment grants nothing')
  assert.match(sql, /revoke all on function public\.activate_paid_order\([^)]*\) from public, anon, authenticated/)
})

// supabase/functions/exchange-rates/index.ts
//
// Daily exchange rates for the currency toggle (DECISIONS.md W4). Called once
// a day by pg_cron (public.request_exchange_rates); fetches units per 1 EUR
// for ALL, USD and GBP from open.er-api.com (free, no key) and upserts
// public.exchange_rates. On any failure nothing is written, so the apps keep
// the last stored rates.
//
// Auth: scheduler only, like saved-search-alerts: the service-role key or the
// vault secret in x-cron-secret. Deployed without JWT verification.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ratesFromResponse } from './logic.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SOURCE = 'https://open.er-api.com/v6/latest/EUR';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isScheduler(req: Request): Promise<boolean> {
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (sameSecret(bearer, SERVICE_ROLE_KEY)) return true;
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!secret) return false;
  const { data, error } = await admin.rpc('push_dispatch_secret_ok', { p_secret: secret });
  return !error && data === true;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await isScheduler(req))) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`source ${res.status}`);
    body = await res.json();
  } catch (e) {
    console.error(JSON.stringify({ fn: 'exchange-rates', step: 'fetch', error: String(e) }));
    return json({ ok: false, error: 'fetch_failed' }, 502);
  }

  const parsed = ratesFromResponse(body);
  if (parsed.error) {
    console.error(JSON.stringify({ fn: 'exchange-rates', step: 'parse', error: parsed.error }));
    return json({ ok: false, error: 'bad_source' }, 502);
  }

  const { error } = await admin.from('exchange_rates').upsert(parsed.rows, { onConflict: 'currency' });
  if (error) {
    console.error(JSON.stringify({ fn: 'exchange-rates', step: 'upsert', error: error.message }));
    return json({ ok: false, error: 'store_failed' }, 500);
  }
  return json({ ok: true, rates: parsed.rows.map((r: { currency: string; per_eur: number }) => [r.currency, r.per_eur]) });
});

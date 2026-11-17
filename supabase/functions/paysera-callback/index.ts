// supabase/functions/paysera-callback/index.ts
//
// Paysera payment callback for prepaid plans and promotions
// (docs/LAUNCH_TASKS.md F15). NOT DEPLOYED: it needs the pending migrations
// supabase/pending/plans_by_period_months.sql and prepaid_checkout.sql, a
// Paysera merchant project, and the owner's prices.
//
// verify_jwt must be false (Paysera does not send a Supabase token); the
// callback authenticates itself with Paysera's RSA signature instead.
// Required secrets: PAYSERA_PROJECT_ID, PAYSERA_SIGN_PASSWORD. Optional:
// PAYSERA_PUBLIC_KEY (PEM; otherwise fetched from Paysera once per instance),
// PAYSERA_TEST_MODE=true to accept sandbox/test payments.
//
// Only this function (service role) can activate an order, and only through
// activate_paid_order(), which also re-checks amount and currency and is
// idempotent per provider event. A browser redirect to the "accept" page
// grants nothing.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeCallbackData, evaluateCallback, PUBLIC_KEY_URL, verifyCallback } from './logic.js';

const PROJECT_ID = Deno.env.get('PAYSERA_PROJECT_ID');
const PASSWORD = Deno.env.get('PAYSERA_SIGN_PASSWORD');
const TEST_MODE = Deno.env.get('PAYSERA_TEST_MODE') === 'true';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

let publicKey: string | null = Deno.env.get('PAYSERA_PUBLIC_KEY') ?? null;
async function payseraKey(): Promise<string | null> {
  if (publicKey) return publicKey;
  const res = await fetch(PUBLIC_KEY_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (res?.ok) publicKey = await res.text();
  return publicKey;
}

const text = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });

Deno.serve(async (req) => {
  if (!PROJECT_ID || !PASSWORD) return text('not_configured', 503);

  const url = new URL(req.url);
  const params = req.method === 'POST'
    ? new URLSearchParams(await req.text())
    : url.searchParams;
  const query = {
    data: params.get('data') ?? '',
    ss1: params.get('ss1') ?? undefined,
    ss2: params.get('ss2') ?? undefined,
    ss3: params.get('ss3') ?? undefined,
  };

  if (!verifyCallback(query, { publicKey: await payseraKey(), password: PASSWORD })) {
    console.error('paysera-callback: bad signature');
    return text('bad_signature', 400);
  }

  const fields = decodeCallbackData(query.data);
  const decision = evaluateCallback(fields, { projectId: PROJECT_ID, testMode: TEST_MODE });
  if (decision.action === 'reject') {
    console.error('paysera-callback: rejected', decision.reason);
    return text('rejected', 400);
  }
  if (decision.action === 'ignore') {
    // Not a completed payment (or a test one in live mode): acknowledge so
    // Paysera stops retrying, grant nothing.
    return text('OK');
  }

  const { data: result, error } = await admin.rpc('activate_paid_order', {
    p_order_id: decision.orderId,
    p_amount_cents: decision.amountCents,
    p_currency: decision.currency,
    p_provider: 'paysera',
    p_event_id: decision.eventId,
    p_payload: { orderid: fields.orderid, status: fields.status, requestid: fields.requestid ?? null, test: fields.test ?? null },
  });
  if (error) {
    // Paysera retries until it gets OK, so a transient failure heals itself.
    console.error('paysera-callback: activation failed', error.code);
    return text('retry', 500);
  }
  if (result !== 'activated' && result !== 'duplicate' && result !== 'already_processed') {
    console.error('paysera-callback: not activated', result, decision.orderId);
  }
  return text('OK');
});

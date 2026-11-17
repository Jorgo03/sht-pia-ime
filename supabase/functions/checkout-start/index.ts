// supabase/functions/checkout-start/index.ts
//
// Starts a website checkout for a prepaid plan or a listing promotion
// (docs/LAUNCH_TASKS.md F15). NOT DEPLOYED, and OFF until CHECKOUT_ENABLED is
// 'true': needs the pending migrations, a Paysera project and real prices.
//
// The signed-in user's own token creates the order through
// create_checkout_order(), so the price, currency and period come from
// public.plans and the ownership checks run as that user. This function only
// turns the order into Paysera's signed redirect.
//
// Secrets: PAYSERA_PROJECT_ID, PAYSERA_SIGN_PASSWORD, SITE_URL,
// CHECKOUT_ENABLED, PAYSERA_TEST_MODE (sandbox).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildPaymentRequest } from '../paysera-callback/logic.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (Deno.env.get('CHECKOUT_ENABLED') !== 'true' || !SITE_URL) return json({ error: 'checkout_disabled' }, 503);

  const authorization = req.headers.get('Authorization') ?? '';
  const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json({ error: 'unauthorized' }, 401);

  let body: { plan_id?: string; property_id?: string | null; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { data: orderId, error } = await asUser.rpc('create_checkout_order', {
    p_plan_id: String(body.plan_id ?? ''),
    p_property_id: body.property_id ?? null,
  });
  if (error || !orderId) return json({ error: error?.code === '54000' ? 'rate_limited' : 'cannot_start' }, error?.code === '54000' ? 429 : 400);

  const { data: order } = await asUser
    .from('checkout_orders')
    .select('id, amount_cents, currency')
    .eq('id', orderId)
    .single();
  if (!order) return json({ error: 'cannot_start' }, 400);

  const request = buildPaymentRequest({
    projectId: Deno.env.get('PAYSERA_PROJECT_ID'),
    password: Deno.env.get('PAYSERA_SIGN_PASSWORD'),
    orderId: order.id,
    amountCents: order.amount_cents,
    currency: order.currency,
    acceptUrl: `${SITE_URL}/pricing?checkout=done`,
    cancelUrl: `${SITE_URL}/pricing?checkout=cancelled`,
    callbackUrl: `${SUPABASE_URL}/functions/v1/paysera-callback`,
    test: Deno.env.get('PAYSERA_TEST_MODE') === 'true',
    lang: typeof body.lang === 'string' ? body.lang.slice(0, 3) : undefined,
  });
  return json({ url: request.url });
});

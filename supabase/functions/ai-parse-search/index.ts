// supabase/functions/ai-parse-search/index.ts
//
// Feature B — natural-language search.
// "apartament me 2 dhoma në Tiranë nën 100000 euro" -> structured filters
// the client feeds into its existing URL-param filter pipeline. Any failure
// returns ai_unavailable and the client silently keeps normal filtering.
//
// Model: claude-haiku-4-5-20251001 (high-volume, cheap).
// Auth: anon allowed (search is public). Rate limit: 60/hour per user-or-IP.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5-20251001';
const RATE_LIMIT_PER_HOUR = 60;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// One atomic step in the database (ai_take_quota): count the last hour and
// record this call together, so parallel requests cannot all slip through.
async function rateLimit(key: string, feature: string, max: number): Promise<boolean> {
  const { data, error } = await admin.rpc('ai_take_quota', {
    p_key: key,
    p_feature: feature,
    p_max: max,
    p_window_seconds: 3600,
  });
  // Fail closed: if usage cannot be recorded, no paid call is made.
  return !error && data === true;
}

// Project-wide ceiling on paid AI calls per feature per 24 hours, across every
// caller (docs/LAUNCH_TASKS.md F1). The per-user and per-IP limits stop one
// caller; this stops many, including one rotating a spoofed x-forwarded-for.
// Set AI_DAILY_CALL_CAP as an Edge Function secret to change it. The default
// is a safety net against runaway cost, not a budget the owner chose; the real
// spend cap belongs in the Anthropic console.
const AI_DAILY_CALL_CAP = Number(Deno.env.get('AI_DAILY_CALL_CAP') ?? '2000');

async function underDailyCap(feature: string): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('feature', feature)
    .gte('created_at', since);
  if (error) return false;
  return (count ?? 0) < AI_DAILY_CALL_CAP;
}

// Signed-out callers are bucketed by IP. The left-most x-forwarded-for entry
// is whatever the client sent; Cloudflare's cf-connecting-ip and the right-most
// hop are written by the platform in front of us, so a caller cannot pick a
// fresh bucket by sending a made-up header.
function clientIp(req: Request): string {
  const hops = (req.headers.get('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return req.headers.get('cf-connecting-ip')?.trim() || hops[hops.length - 1] || 'anon';
}

async function callerKey(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data } = await admin.auth.getUser(token);
  if (data?.user) return data.user.id;
  return clientIp(req);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ANTHROPIC_KEY) return json({ error: 'ai_unavailable' }, 503);

    let query: unknown;
    try {
      ({ query } = await req.json());
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    const q = String(query ?? '').trim().slice(0, 300);
    if (!q) return json({ error: 'empty_query' }, 400);

    if (!(await rateLimit(await callerKey(req), 'parse-search', RATE_LIMIT_PER_HOUR))) {
      return json({ error: 'rate_limited' }, 429);
    }
    if (!(await underDailyCap('parse-search'))) {
      // Same answer as any AI outage: the client keeps working without AI.
      return json({ error: 'ai_unavailable' }, 503);
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system:
          'Parse real-estate search queries for an Albanian property marketplace into structured filters. ' +
          'Queries are usually Albanian but may be any language. Give prices in the currency the user ' +
          'named and set currency: "lekë"/"lek"/"ALL" = ALL, "$"/"dollarë"/"USD" = USD, otherwise EUR ' +
          '(convert "100 mijë"/"100k" to 100000, "15 milionë" to 15000000). "dhoma"/"dhomë" = bedrooms; "2+1" means 2 bedrooms. ' +
          '"me qira" = rent, "në shitje"/"per shitje" = sale, "qira ditore" = daily_rent. ' +
          'Only set fields the user actually specified — never guess.',
        messages: [{ role: 'user', content: q }],
        tools: [{
          name: 'set_filters',
          description: 'Structured search filters extracted from the query',
          input_schema: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'Albanian town or municipality, in Albanian spelling, e.g. Tiranë, Durrës, Vlorë' },
              listing_type: { type: 'string', enum: ['sale', 'rent', 'daily_rent'] },
              property_type: { type: 'string', enum: ['apartment', 'villa', 'house', 'land', 'commercial', 'office', 'garage'] },
              min_price: { type: 'number' },
              max_price: { type: 'number' },
              currency: { type: 'string', enum: ['EUR', 'ALL', 'USD'], description: 'Currency of min_price and max_price' },
              beds: { type: 'number', description: 'Minimum bedrooms' },
            },
          },
        }],
        tool_choice: { type: 'tool', name: 'set_filters' },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!r.ok) {
      // Status only: the upstream body can echo the visitor's query.
      console.error('Anthropic error', r.status);
      return json({ error: 'ai_unavailable' }, 503);
    }

    const data = await r.json();
    const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use');
    if (!toolUse?.input) return json({ error: 'ai_unavailable' }, 503);

    return json({ filters: toolUse.input });
  } catch (err) {
    console.error('ai-parse-search error', err instanceof Error ? err.message : String(err));
    return json({ error: 'ai_unavailable' }, 503);
  }
});

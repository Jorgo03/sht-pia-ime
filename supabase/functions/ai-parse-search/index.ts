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

async function rateLimit(key: string, feature: string, max: number): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .eq('feature', feature)
    .gte('created_at', since);
  if ((count ?? 0) >= max) return false;
  await admin.from('ai_usage').insert({ key, feature });
  return true;
}

async function callerKey(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data } = await admin.auth.getUser(token);
  if (data?.user) return data.user.id;
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ANTHROPIC_KEY) return json({ error: 'ai_unavailable' }, 503);

    const { query } = await req.json();
    const q = String(query ?? '').trim().slice(0, 300);
    if (!q) return json({ error: 'empty_query' }, 400);

    if (!(await rateLimit(await callerKey(req), 'parse-search', RATE_LIMIT_PER_HOUR))) {
      return json({ error: 'rate_limited' }, 429);
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
          'Queries are usually Albanian but may be any language. Prices are EUR unless stated otherwise ' +
          '(convert "100 mijë"/"100k" to 100000). "dhoma"/"dhomë" = bedrooms; "2+1" means 2 bedrooms. ' +
          '"me qira" = rent, "në shitje"/"per shitje" = sale, "qira ditore" = daily_rent. ' +
          'Only set fields the user actually specified — never guess.',
        messages: [{ role: 'user', content: q }],
        tools: [{
          name: 'set_filters',
          description: 'Structured search filters extracted from the query',
          input_schema: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City name in Albanian spelling, e.g. Tiranë, Durrës' },
              listing_type: { type: 'string', enum: ['sale', 'rent', 'daily_rent'] },
              property_type: { type: 'string', enum: ['apartment', 'villa', 'house', 'land', 'commercial', 'office', 'garage'] },
              min_price: { type: 'number' },
              max_price: { type: 'number' },
              beds: { type: 'number', description: 'Minimum bedrooms' },
            },
          },
        }],
        tool_choice: { type: 'tool', name: 'set_filters' },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!r.ok) {
      console.error('Anthropic error', r.status, await r.text());
      return json({ error: 'ai_unavailable' }, 503);
    }

    const data = await r.json();
    const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use');
    if (!toolUse?.input) return json({ error: 'ai_unavailable' }, 503);

    return json({ filters: toolUse.input });
  } catch (err) {
    console.error('ai-parse-search error', err);
    return json({ error: 'ai_unavailable' }, 503);
  }
});

// supabase/functions/ai-generate-listing/index.ts
//
// Feature A — AI listing generator (flagship).
// Agent sends raw property details + free-form notes; Claude Sonnet writes a
// polished title, description, and highlight bullets in the requested
// language (Albanian by default). Output is a draft the agent edits in the
// wizard before publishing — nothing is auto-published.
//
// Model: claude-sonnet-5 (quality-critical generation; NOT Fable-tier cost).
// Auth: requires a signed-in user. Rate limit: 20 generations/hour/user.
// Missing ANTHROPIC_API_KEY -> 503 { error: 'ai_unavailable' } (client falls
// back to manual writing).

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
const MODEL = 'claude-sonnet-5';
const RATE_LIMIT_PER_HOUR = 20;

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

const LANG_NAMES: Record<string, string> = {
  sq: 'Albanian', en: 'English', de: 'German', it: 'Italian',
  es: 'Spanish', pl: 'Polish', ru: 'Russian', fr: 'French',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ANTHROPIC_KEY) return json({ error: 'ai_unavailable' }, 503);

    // Must be a signed-in user (listing creation is authenticated anyway)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    if (!(await rateLimit(user.id, 'generate-listing', RATE_LIMIT_PER_HOUR))) {
      return json({ error: 'rate_limited' }, 429);
    }

    const { details = {}, language = 'sq' } = await req.json();
    const langName = LANG_NAMES[language] ?? 'Albanian';

    // Whitelist the fields the model may see; cap free-text length.
    const facts = {
      listing_type: details.listing_type,
      property_type: details.property_type,
      city: details.city,
      address: details.address,
      price: details.price,
      currency: details.currency,
      sqft: details.sqft,
      beds: details.beds,
      baths: details.baths,
      floor: details.floor,
      total_floors: details.total_floors,
      year_built: details.year_built,
      features: Array.isArray(details.features) ? details.features.slice(0, 20) : [],
      agent_notes: String(details.notes ?? '').slice(0, 2000),
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // Sonnet 5 runs adaptive thinking by default (Sonnet 4.6 did not), and
        // max_tokens caps thinking + output together. This is a forced
        // tool_choice extraction, so thinking buys nothing and only risks
        // eating the budget before the tool_use block is emitted.
        thinking: { type: 'disabled' },
        max_tokens: 2000,
        system:
          `You are an expert real-estate copywriter for Shtëpia.ime, an Albanian property marketplace. ` +
          `Write in ${langName}. Use ONLY the facts provided — never invent amenities, measurements, ` +
          `neighborhood claims, or anything not in the data. If agent_notes mention something, you may use it. ` +
          `Tone: warm, professional, concrete. No discriminatory language, no superlatives you cannot back up, ` +
          `no emojis, no ALL CAPS. Description: 70–130 words, flowing prose (no bullet lists inside it).`,
        messages: [{
          role: 'user',
          content: `Write listing copy for this property:\n${JSON.stringify(facts, null, 2)}`,
        }],
        tools: [{
          name: 'listing_copy',
          description: 'The finished listing copy',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Punchy listing title, max 70 characters' },
              description: { type: 'string', description: '70-130 word description, prose only' },
              highlights: {
                type: 'array',
                items: { type: 'string' },
                description: '3-5 short highlight bullets drawn strictly from the facts',
              },
            },
            required: ['title', 'description', 'highlights'],
          },
        }],
        tool_choice: { type: 'tool', name: 'listing_copy' },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!r.ok) {
      // The body can echo account details, so it goes to the log only. The
      // response carries just the status code — enough to tell auth (401)
      // from billing (400) from an upstream rate limit (429).
      console.error('Anthropic error', r.status, await r.text());
      return json({ error: 'ai_unavailable', upstream_status: r.status }, 503);
    }

    const data = await r.json();
    const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use');
    if (!toolUse?.input?.title) {
      // 200 from Anthropic but no tool call — previously indistinguishable
      // from an upstream rejection. stop_reason 'max_tokens' here means the
      // budget ran out before the tool block was emitted.
      console.error('No tool_use block', data.stop_reason, JSON.stringify(data.usage));
      return json(
        { error: 'ai_unavailable', upstream_status: 200, stop_reason: data.stop_reason ?? null },
        503,
      );
    }

    return json({
      title: String(toolUse.input.title).slice(0, 120),
      description: String(toolUse.input.description ?? ''),
      highlights: (toolUse.input.highlights ?? []).slice(0, 5).map(String),
      language,
    });
  } catch (err) {
    console.error('ai-generate-listing error', err);
    return json({ error: 'ai_unavailable' }, 503);
  }
});

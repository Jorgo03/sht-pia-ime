// supabase/functions/translate-property/index.ts
//
// Real-estate translation of a listing's title + description.
//
// Why this stopped being a Google-Translate -> DeepL pipeline: neither takes
// an instruction, and the listings here are full of things a general-purpose
// engine gets wrong in exactly the ways that embarrass an agency. "Apartament
// 2+1 ne Bllok" came back as "Apartment 2+1 in Block" - Blloku is a Tirana
// neighbourhood, not a building block - and the 2+1 room notation, m2 values,
// floor numbers and bullet layout were all fair game for reformatting. A
// prompted model can be told to leave proper nouns and numeric notation alone,
// so this runs on the same Anthropic integration the other AI functions
// already use (same key, same ai_usage rate-limit ledger, same forced
// tool_choice extraction), rather than adding a third translation vendor.
//
// Request - primary shape (one target, both fields, ONE upstream call):
//   { title?, description?, sourceLanguage?='sq', targetLanguage }
//   -> { title, description, targetLanguage }
//
// Request - legacy shape, still used by scripts/bulk-translate.js:
//   { text, source?='sq' }
//   -> { sq, en, de, it, es, pl, ru, fr }
//
// Auth: a signed-in user (rate-limited 60/hour) or the service role (scripts,
// not rate-limited). Missing ANTHROPIC_API_KEY -> 503 { error: 'ai_unavailable' }.

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
const RATE_LIMIT_PER_HOUR = 60;

// Caps on what reaches the model. properties.title is short by convention and
// the description field is a textarea, so these are generous ceilings against
// a pathological payload rather than limits a real listing would ever meet.
const MAX_TITLE_CHARS = 300;
const MAX_DESCRIPTION_CHARS = 6000;

const LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr'] as const;
type Lang = (typeof LANGS)[number];

const LANG_NAMES: Record<Lang, string> = {
  sq: 'Albanian',
  en: 'English',
  de: 'German',
  it: 'Italian',
  es: 'Spanish',
  pl: 'Polish',
  ru: 'Russian',
  fr: 'French',
};

const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (LANGS as readonly string[]).includes(v);

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

/**
 * Reads the `role` claim without verifying the signature.
 *
 * Safe only because it is not used to grant anything: Supabase's own gateway
 * has already rejected the request unless the JWT is validly signed by this
 * project (verify_jwt is on). This just distinguishes an already-trusted
 * service-role caller from an already-trusted end user, to decide which of the
 * two is rate-limited. A forged token never reaches this line.
 */
function jwtRole(token: string): string | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
    return typeof decoded?.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a professional real-estate translator for Shtepia.ime, a property marketplace in Albania. You translate listing copy written by estate agents.

Translate faithfully and idiomatically - the result must read like a native estate agent wrote it, not like a machine converted it word for word.

MUST PRESERVE EXACTLY, never translated, localised, converted or reformatted:
- Room notation: 1+1, 2+1, 2+1+2, 3+1, and similar. These are Albanian apartment layouts. Keep the digits and plus signs verbatim.
- All numbers, prices, currencies and currency symbols.
- Measurements and their units: m2, sqm, ha. Do not convert metric to imperial.
- Floor numbers and floor counts.
- Dates, phone numbers, URLs, email addresses.
- Proper nouns: street names, city names, neighbourhood names, residence and building names, company and agency names.

Proper nouns are the most common failure and the most damaging. Albanian place names frequently look like ordinary words - "Bllok"/"Blloku" is a district of Tirana, NOT the word "block"; "Ali Demi", "Kombinat", "Astir", "Yzberisht", "Sauk" and similar are place names. Never translate the meaning of a place name. Keep it in its Albanian form.

FORMATTING - reproduce the source's structure exactly:
- Keep line breaks, blank lines and paragraph splits where they are.
- Keep bullet points, keeping the same marker character and one bullet per source bullet.
- Never merge a bulleted list into a paragraph, and never split a paragraph into bullets.

CONTENT:
- Never invent information that is not in the source. No added amenities, no added neighbourhood claims.
- Never omit information that is in the source.
- Never add marketing or superlatives the source does not contain.
- Keep the professional, factual tone of the original.
- Titles stay short and natural for a listing headline; do not pad them.
- If a field is empty in the source, return an empty string for it.

Return only the translation, through the provided tool. No commentary.`;

interface FieldPair {
  title: string;
  description: string;
}

/**
 * One upstream call, however many targets are asked for.
 *
 * Title and description travel together on purpose: they are one piece of copy
 * and the model translates the title better for having read the description
 * (it disambiguates whether a bare word is a place name). It also halves the
 * request count versus a field-at-a-time design.
 */
async function translate(
  source: Lang,
  targets: Lang[],
  fields: FieldPair,
): Promise<Record<string, FieldPair>> {
  const langProperties: Record<string, unknown> = {};
  for (const target of targets) {
    langProperties[target] = {
      type: 'object',
      description: `The ${LANG_NAMES[target]} translation.`,
      properties: {
        title: { type: 'string', description: 'Translated title, or "" if the source title was empty.' },
        description: {
          type: 'string',
          description:
            'Translated description with the source line breaks and bullets preserved, or "" if the source description was empty.',
        },
      },
      required: ['title', 'description'],
    };
  }

  // Budget scales with the work: the response carries a full title +
  // description per target language, so a fixed cap would silently truncate
  // the legacy 7-language path and produce no tool_use block at all.
  const maxTokens = Math.min(16000, 1500 + targets.length * 1800);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      // Same reasoning as ai-generate-listing: this is a forced tool_choice
      // extraction, so thinking tokens buy nothing and would eat the budget
      // before the tool_use block is emitted.
      thinking: { type: 'disabled' },
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            `Source language: ${LANG_NAMES[source]}\n` +
            `Translate into: ${targets.map((t) => LANG_NAMES[t]).join(', ')}\n\n` +
            `TITLE:\n${fields.title || '(empty)'}\n\n` +
            `DESCRIPTION:\n${fields.description || '(empty)'}`,
        },
      ],
      tools: [
        {
          name: 'listing_translation',
          description: 'The finished translations, one entry per requested language.',
          input_schema: {
            type: 'object',
            properties: langProperties,
            required: targets,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'listing_translation' },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    // The upstream body can echo account details, so it goes to the log only.
    console.error('Anthropic error', response.status, await response.text());
    throw Object.assign(new Error('upstream'), { upstreamStatus: response.status });
  }

  const data = await response.json();
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolUse?.input) {
    console.error('No tool_use block', data.stop_reason, JSON.stringify(data.usage));
    throw Object.assign(new Error('no_tool_use'), {
      upstreamStatus: 200,
      stopReason: data.stop_reason ?? null,
    });
  }

  const out: Record<string, FieldPair> = {};
  for (const target of targets) {
    const entry = toolUse.input[target];
    out[target] = {
      title: typeof entry?.title === 'string' ? entry.title.trim() : '',
      description: typeof entry?.description === 'string' ? entry.description.trim() : '',
    };
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // Checked before auth so an unconfigured project reports the real problem
    // (server misconfiguration) rather than looking like a rejected caller.
    if (!ANTHROPIC_KEY) return json({ error: 'ai_unavailable' }, 503);

    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const role = jwtRole(token);
    let rateLimitKey: string | null = null;

    if (role === 'service_role') {
      // Backfill scripts run under the service role. Not rate-limited: they
      // are already throttled by their own caller and are not user traffic.
      rateLimitKey = null;
    } else {
      const { data: userData } = await admin.auth.getUser(token);
      const user = userData?.user;
      if (!user) return json({ error: 'unauthorized' }, 401);
      rateLimitKey = user.id;
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const legacy = typeof body.text === 'string';

    const source = body.sourceLanguage ?? body.source ?? 'sq';
    if (!isLang(source)) return json({ error: 'unsupported_source_language' }, 400);

    let targets: Lang[];
    if (legacy) {
      targets = LANGS.filter((l) => l !== source);
    } else {
      const target = body.targetLanguage;
      if (!isLang(target)) return json({ error: 'unsupported_target_language' }, 400);
      if (target === source) return json({ error: 'target_equals_source' }, 400);
      targets = [target];
    }

    const rawTitle = legacy ? body.text : body.title;
    const rawDescription = legacy ? '' : body.description;

    const fields: FieldPair = {
      title: typeof rawTitle === 'string' ? rawTitle.trim().slice(0, MAX_TITLE_CHARS) : '',
      description:
        typeof rawDescription === 'string'
          ? rawDescription.trim().slice(0, MAX_DESCRIPTION_CHARS)
          : '',
    };

    // Nothing to translate is a client bug, not a reason to bill a request.
    if (!fields.title && !fields.description) {
      return json({ error: 'empty_content' }, 400);
    }

    if (rateLimitKey && !(await rateLimit(rateLimitKey, 'translate-property', RATE_LIMIT_PER_HOUR))) {
      return json({ error: 'rate_limited' }, 429);
    }

    const result = await translate(source, targets, fields);

    if (legacy) {
      // Legacy callers expect a flat { lang: text } map including the source.
      const flat: Record<string, string> = { [source]: fields.title };
      for (const target of targets) {
        if (result[target]?.title) flat[target] = result[target].title;
      }
      return json(flat);
    }

    const target = targets[0];
    return json({
      title: result[target]?.title ?? '',
      description: result[target]?.description ?? '',
      targetLanguage: target,
    });
  } catch (err) {
    const upstreamStatus = (err as { upstreamStatus?: number })?.upstreamStatus;
    if (upstreamStatus) {
      return json(
        {
          error: 'ai_unavailable',
          upstream_status: upstreamStatus,
          stop_reason: (err as { stopReason?: string | null })?.stopReason ?? null,
        },
        503,
      );
    }
    console.error('translate-property error', err);
    return json({ error: 'ai_unavailable' }, 503);
  }
});

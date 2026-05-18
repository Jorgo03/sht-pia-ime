// supabase/functions/translate-property/index.ts
//
// Hybrid translation: Albanian -> English (Google) -> 6 other languages (DeepL)
// Input:  { text: string, source?: 'sq' | 'en' }
// Output: { sq, en, de, it, es, pl, ru, fr }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const GOOGLE_KEY = Deno.env.get('GOOGLE_TRANSLATE_KEY')!;
const DEEPL_KEY  = Deno.env.get('DEEPL_API_KEY')!;
const DEEPL_HOST = Deno.env.get('DEEPL_API_HOST') || 'https://api-free.deepl.com';

const DEEPL_TARGETS: Record<string, string> = {
  de: 'DE',
  it: 'IT',
  es: 'ES',
  pl: 'PL',
  ru: 'RU',
  fr: 'FR',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function googleTranslate(text: string, source: string, target: string): Promise<string> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source, target, format: 'text' }),
  });
  if (!r.ok) throw new Error(`Google API ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.data.translations[0].translatedText;
}

async function deeplTranslate(text: string, targetLang: string): Promise<string> {
  const r = await fetch(`${DEEPL_HOST}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: 'EN',
      target_lang: targetLang,
      preserve_formatting: true,
    }),
  });
  if (!r.ok) throw new Error(`DeepL API ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.translations[0].text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, source = 'sq' } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty "text" field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Record<string, string> = {};
    results[source] = text;

    // Step 1: Get English version
    let english: string;
    if (source === 'en') {
      english = text;
    } else {
      english = await googleTranslate(text, source, 'en');
      results['en'] = english;
    }

    // Step 2: DeepL English -> 6 other languages, in parallel
    const tasks = Object.entries(DEEPL_TARGETS).map(async ([code, deeplCode]) => {
      try {
        const translated = await deeplTranslate(english, deeplCode);
        return [code, translated] as const;
      } catch (err) {
        console.error(`DeepL failed for ${code}:`, err);
        return [code, ''] as const;
      }
    });

    const translations = await Promise.all(tasks);
    for (const [code, value] of translations) {
      if (value) results[code] = value;
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Translation error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

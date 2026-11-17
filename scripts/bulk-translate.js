// scripts/bulk-translate.js
//
// Backfill: fill in every listing translation the listing wizard never
// produced. The wizard only translates the language whose tab an agent
// actually opens (useListingTranslation.ts), so a listing published without
// opening all eight tabs reaches the site with only a couple of languages
// stored. Card surfaces resolve titles synchronously through
// getLocalizedText(), which falls back to English on a miss and never asks
// anyone to translate — so those listings show an English title no matter
// which language the visitor picks. This script closes that gap in the data,
// which is the only place it can be closed without making every card fire a
// network request.
//
// Usage:
//   node scripts/bulk-translate.js               (fill everything missing)
//   node scripts/bulk-translate.js --limit=10    (only first 10 — good for testing)
//   node scripts/bulk-translate.js --dry-run     (show what would happen, don't write)
//
// Reads SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
// The service role is what lets this bypass the per-caller rate limit that
// exists to bound interactive use; a backfill is not interactive.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

import {
  SOURCE_LANG,
  SUPPORTED_LANGS,
  markGenerated,
  mergeTranslation,
  sanitizeTranslationResponse,
  shouldTranslate,
  sourceFingerprint,
} from '../src/lib/translationCore.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Parse CLI args
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const DRY_RUN = args.includes('--dry-run');
const SLEEP_MS = 1500; // throttle: 1.5 s between calls, to be polite to the upstream engine

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * One language at a time, rather than the legacy `{ text }` shape that returns
 * every language at once. The legacy shape carries no description and no
 * provenance, and its response replaces the whole i18n map — which is how a
 * hand-written translation gets silently overwritten. Per-language keeps each
 * write additive and lets the result be recorded in translation_meta.
 */
async function translateOne({ title, description, targetLanguage, sourceLanguage }) {
  const { data, error } = await supabase.functions.invoke('translate-property', {
    body: { title, description, targetLanguage, sourceLanguage },
  });
  if (error) throw error;
  return sanitizeTranslationResponse(data, {
    wantTitle: Boolean(title),
    wantDescription: Boolean(description),
  });
}

async function processProperty(p) {
  const sourceLang = p.source_language || SOURCE_LANG;
  const title = p.title_i18n?.[sourceLang] || p.title || '';
  const description = p.description_i18n?.[sourceLang] || p.description || '';
  const fingerprint = sourceFingerprint(title, description);

  if (!fingerprint) {
    console.log('  ⏭️  No source text to translate from, skipping.');
    return false;
  }

  let titleMap = p.title_i18n && typeof p.title_i18n === 'object' ? { ...p.title_i18n } : {};
  let descriptionMap =
    p.description_i18n && typeof p.description_i18n === 'object' ? { ...p.description_i18n } : {};
  let meta = p.translation_meta && typeof p.translation_meta === 'object' ? { ...p.translation_meta } : {};

  // The source language is stored like any other so getLocalizedText() can
  // find it; a listing whose map is missing its own language shows English.
  if (!titleMap[sourceLang] && title) titleMap[sourceLang] = title;
  if (!descriptionMap[sourceLang] && description) descriptionMap[sourceLang] = description;

  const targets = SUPPORTED_LANGS.filter((lang) => lang !== sourceLang);
  const filled = [];

  for (const lang of targets) {
    // shouldTranslate() is the wizard's own rule, reused verbatim: it answers
    // no for a translation that is already current AND for one a human wrote
    // (including the text-without-metadata case the core treats as manual).
    // A backfill must never overwrite an agent's own words.
    const needed = shouldTranslate({
      lang,
      title: titleMap[lang],
      description: descriptionMap[lang],
      meta,
      fingerprint,
    });
    if (!needed) continue;

    if (DRY_RUN) {
      filled.push(lang);
      continue;
    }

    try {
      const result = await translateOne({
        title,
        description,
        targetLanguage: lang,
        sourceLanguage: sourceLang,
      });
      if (!result) {
        console.log(`  ⚠️  ${lang}: engine returned nothing usable, leaving as is`);
        continue;
      }
      titleMap = mergeTranslation(titleMap, lang, result.title);
      descriptionMap = mergeTranslation(descriptionMap, lang, result.description);
      meta = markGenerated(meta, lang, fingerprint);
      filled.push(lang);
    } catch (err) {
      // One language failing is not a reason to abandon the other six, or to
      // lose the ones already translated in this pass — they are written below.
      console.error(`  ❌ ${lang}: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }

  if (filled.length === 0) {
    console.log('  ⏭️  Every language already current or manually written, skipping.');
    return false;
  }

  if (DRY_RUN) {
    console.log(`  💡 [DRY RUN] Would fill: ${filled.join(', ')}`);
    return true;
  }

  const { error } = await supabase
    .from('properties')
    .update({
      title_i18n: titleMap,
      description_i18n: descriptionMap,
      translation_meta: meta,
    })
    .eq('id', p.id);

  if (error) {
    console.error(`  ❌ Update failed for ${p.id}:`, error.message);
    return false;
  }
  console.log(`  ✅ Filled ${filled.join(', ')}`);
  return true;
}

async function main() {
  console.log(`🌍 FHO Bulk Translation${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`   Limit: ${LIMIT || 'all'}`);
  console.log('');

  let query = supabase
    .from('properties')
    .select('id, title, description, title_i18n, description_i18n, translation_meta, source_language')
    .order('created_at', { ascending: false });

  if (LIMIT) query = query.limit(LIMIT);

  const { data: properties, error } = await query;
  if (error) {
    console.error('❌ Failed to fetch properties:', error.message);
    process.exit(1);
  }

  console.log(`📊 Found ${properties.length} properties to check\n`);

  let translated = 0;
  let skipped = 0;

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    console.log(`[${i + 1}/${properties.length}] Property ${p.id}`);
    try {
      const didWork = await processProperty(p);
      if (didWork) translated++;
      else skipped++;
    } catch (err) {
      console.error(`  ❌ Error:`, err.message);
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Translated: ${translated}`);
  console.log(`⏭️  Skipped:    ${skipped}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

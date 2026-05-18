// scripts/bulk-translate.js
//
// One-time backfill: translate all properties that only have `sq` filled.
// Usage:
//   node scripts/bulk-translate.js               (translate everything missing)
//   node scripts/bulk-translate.js --limit=10    (only first 10 — good for testing)
//   node scripts/bulk-translate.js --dry-run     (show what would happen, don't write)

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

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
const SLEEP_MS = 1500; // throttle: 1.5 s between calls (DeepL free is 500k chars/mo)

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callEdgeFunction(text, source = 'sq') {
  const { data, error } = await supabase.functions.invoke('translate-property', {
    body: { text, source },
  });
  if (error) throw error;
  return data;
}

function needsTranslation(field) {
  if (!field || typeof field !== 'object') return true;
  const keys = Object.keys(field);
  return keys.length < 4;
}

async function processProperty(p) {
  const updates = {};

  if (p.title_i18n?.sq && needsTranslation(p.title_i18n)) {
    console.log(`  📝 Translating title: "${p.title_i18n.sq.slice(0, 60)}..."`);
    if (!DRY_RUN) {
      updates.title_i18n = await callEdgeFunction(p.title_i18n.sq, 'sq');
      await sleep(SLEEP_MS);
    }
  }

  if (p.description_i18n?.sq && needsTranslation(p.description_i18n)) {
    console.log(`  📝 Translating description: "${p.description_i18n.sq.slice(0, 60)}..."`);
    if (!DRY_RUN) {
      updates.description_i18n = await callEdgeFunction(p.description_i18n.sq, 'sq');
      await sleep(SLEEP_MS);
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log('  ⏭️  Already translated, skipping.');
    return false;
  }

  if (DRY_RUN) {
    console.log('  💡 [DRY RUN] Would update with:', Object.keys(updates).join(', '));
    return true;
  }

  const { error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', p.id);

  if (error) {
    console.error(`  ❌ Update failed for ${p.id}:`, error.message);
    return false;
  }
  console.log(`  ✅ Updated property ${p.id}`);
  return true;
}

async function main() {
  console.log(`🌍 FHO Bulk Translation${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`   Limit: ${LIMIT || 'all'}`);
  console.log('');

  let query = supabase
    .from('properties')
    .select('id, title_i18n, description_i18n')
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

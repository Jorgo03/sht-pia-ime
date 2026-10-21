#!/usr/bin/env node
// After `expo export -p web`: finishes the website built from the Expo app.
//
//   node scripts/expo-web-postbuild.mjs <export dir>
//
// 1. Moves font assets out of assets/node_modules (see scripts/expo-web/seo.mjs).
// 2. One HTML file per active listing (property/<id>.html) with that
//    listing's title, description, image and canonical URL, so search engines
//    and link previews see them without running the app. New listings
//    between builds still work: they fall back to property/[id].html.
// 3. sitemap.xml, robots.txt, and 404.html from the app's not-found page.
//
// Reads only public, RLS-filtered data with the public (anon) key, exactly as
// any visitor does. If the database cannot be reached, steps 2 and the
// sitemap's listings are skipped and the build still succeeds.
import fs from 'node:fs';
import path from 'node:path';

import { ASSET_FROM, ASSET_TO, applyHead, isListingId, listingHead, relocateAssetRefs, robotsTxt, sitemapXml } from './expo-web/seo.mjs';

const dir = path.resolve(process.argv[2] || 'dist-expo');
if (!fs.existsSync(path.join(dir, 'index.html'))) {
  console.error(`expo-web-postbuild: ${dir} has no index.html; run expo export first`);
  process.exit(1);
}
const site = (process.env.EXPO_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

function walk(d, out = []) {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1. Assets.
const fromDir = path.join(dir, ASSET_FROM);
if (fs.existsSync(fromDir)) {
  fs.mkdirSync(path.dirname(path.join(dir, ASSET_TO, 'x')), { recursive: true });
  fs.rmSync(path.join(dir, ASSET_TO), { recursive: true, force: true });
  fs.renameSync(fromDir, path.join(dir, ASSET_TO));
  let rewritten = 0;
  for (const file of walk(dir)) {
    if (!/\.(html|js|css|json)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(ASSET_FROM)) continue;
    fs.writeFileSync(file, relocateAssetRefs(text));
    rewritten += 1;
  }
  console.log(`expo-web-postbuild: assets moved to ${ASSET_TO} (${rewritten} files updated)`);
}

// 2. Listing pages.
async function activeListings() {
  // https in real builds; a local address only for testing this script.
  const allowed = supabaseUrl.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(supabaseUrl);
  if (!allowed || !anonKey) throw new Error('EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY not set');
  const rows = [];
  // Supabase caps a response at 1000 rows by default, so page through.
  for (let offset = 0; offset < 50000; offset += 1000) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/properties?select=id,title,title_i18n,description,description_i18n,city,image_urls,updated_at&status=eq.active&order=updated_at.desc&limit=1000&offset=${offset}`,
      { headers: { apikey: anonKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows.filter((r) => isListingId(r.id));
}

let listings = [];
try {
  listings = await activeListings();
} catch (e) {
  console.warn(`expo-web-postbuild: listing pages and sitemap listings skipped (${e.message})`);
}

const template = fs.readFileSync(path.join(dir, 'property', '[id].html'), 'utf8');
const siteDescription = (template.match(/<meta data-rh="true" name="description" content="([^"]*)"/) || [])[1] || '';
if (site.startsWith('https://')) {
  for (const row of listings) {
    const html = applyHead(template, listingHead(row, { site, siteDescription }));
    fs.writeFileSync(path.join(dir, 'property', `${row.id}.html`), html);
  }
  console.log(`expo-web-postbuild: ${listings.length} listing pages written`);
} else if (listings.length) {
  console.warn('expo-web-postbuild: EXPO_PUBLIC_SITE_URL not set; listing pages need absolute URLs and were skipped');
}

// 3. sitemap, robots, 404.
if (site.startsWith('https://')) {
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), sitemapXml(site, listings));
  fs.writeFileSync(path.join(dir, 'robots.txt'), robotsTxt(site));
}
const notFound = path.join(dir, '+not-found.html');
if (fs.existsSync(notFound)) fs.copyFileSync(notFound, path.join(dir, '404.html'));
console.log('expo-web-postbuild: done');

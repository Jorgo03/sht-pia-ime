#!/usr/bin/env node
// Builds the website (website/, DECISIONS.md W10) into dist/ for Vercel.
//
// Vite builds the site (website/vite.config.mjs), then this adds what the
// live address does for the phone apps:
//   - /privacy, /terms, /cookies: the legal pages the apps link to, rendered
//     from src/features/legal/content/ (the same texts the apps show);
//   - public/ (icons, /.well-known/ app links);
//   - /api/auth-relay lives in the root api/ folder and is served by Vercel
//     on its own, whatever this build writes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, process.argv[2] || 'dist');

const sq = await import('../src/features/legal/content/sq.js');
const en = await import('../src/features/legal/content/en.js');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const contactEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL || '').trim())
  ? process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL.trim()
  : null;

function renderDoc(doc, contact) {
  const parts = doc.intro.map((p) => `<p>${esc(p)}</p>`);
  for (const s of doc.sections) {
    parts.push(`<h2>${esc(s.h)}</h2>`);
    for (const p of s.p ?? []) parts.push(`<p>${esc(p)}</p>`);
    if (s.ul?.length) parts.push(`<ul>${s.ul.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`);
    for (const p of s.p2 ?? []) parts.push(`<p>${esc(p)}</p>`);
    if (s.contact) {
      parts.push(contactEmail
        ? `<p>${esc(contact.withEmail)}<a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></p>`
        : `<p>${esc(contact.withoutEmail)}</p>`);
    }
  }
  return parts.join('\n');
}

const PAGES = [
  { slug: 'privacy', sq: 'Politika e privatësisë', en: 'Privacy Policy' },
  { slug: 'terms', sq: 'Kushtet e shërbimit', en: 'Terms of Service' },
  { slug: 'cookies', sq: 'Politika e cookies', en: 'Cookie Policy' },
];

function page({ slug, sq: titleSq, en: titleEn }) {
  return `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(titleSq)} | Shtëpia.ime</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<style>
  body { margin: 0; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1714; background: #fff; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 20px 80px; }
  h1 { font-size: 32px; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  .updated { color: #6b6158; font-size: 14px; }
  hr { border: 0; border-top: 1px solid #e5ded5; margin: 56px 0; }
  a { color: #b84a00; }
</style>
</head>
<body>
<main>
<h1>${esc(titleSq)}</h1>
<p class="updated">Përditësuar më ${esc(en.UPDATED)}</p>
${renderDoc(sq[slug], sq.contact)}
<hr />
<h1 lang="en">${esc(titleEn)}</h1>
<div lang="en">
${renderDoc(en[slug], en.contact)}
</div>
</main>
</body>
</html>
`;
}

execFileSync(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', path.join(root, 'website', 'vite.config.mjs'), '--outDir', out], { stdio: 'inherit' });
// Icons and /.well-known; never over a file the site build wrote.
fs.cpSync(path.join(root, 'public'), out, { recursive: true, force: false });
for (const p of PAGES) {
  fs.mkdirSync(path.join(out, p.slug), { recursive: true });
  fs.writeFileSync(path.join(out, p.slug, 'index.html'), page(p));
}
console.log(`build-website: wrote ${path.relative(root, out)} (site + ${PAGES.map((p) => p.slug).join(', ')})`);

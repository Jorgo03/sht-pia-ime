// Screenshots the real Shtëpia.ime app (its Expo web build) filled with the
// fictional listings in demo-listings.mjs, for the launch video.
//
//   node marketing/launch-video/capture/capture.mjs <expo-web-export-dir> [light|dark]
//
// Every Supabase request is answered here, in the browser, the same way
// e2e/support/backend.ts does it: nothing is read from or written to
// production. Map tiles, fonts and leaflet.css load from the internet.
// Output: ../assets/screens/<theme>/*.png at 1290x2796 (iPhone 6.7").
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { AGENT, LISTINGS } from './demo-listings.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const exportDir = path.resolve(process.argv[2] ?? path.join(repo, 'dist-expo'));
const theme = process.argv[3] === 'dark' ? 'dark' : 'light';
const out = path.join(here, '../assets/screens', theme);
const photos = path.join(here, '../assets/photos');
const PORT = 4190;
fs.mkdirSync(out, { recursive: true });

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route, body, headers = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...CORS, ...headers }, body: JSON.stringify(body) });

function filterRows(params) {
  let rows = LISTINGS;
  for (const [column, expr] of params) {
    if (['select', 'order', 'limit', 'offset', 'or'].includes(column)) continue;
    const [op, ...rest] = expr.split('.');
    const value = rest.join('.');
    if (op === 'eq') rows = rows.filter((r) => String(r[column]) === value);
    if (op === 'in') rows = rows.filter((r) => value.replace(/[()"]/g, '').split(',').includes(String(r[column])));
    if (op === 'ilike') rows = rows.filter((r) => String(r[column] ?? '').toLowerCase().includes(value.replace(/[*%]/g, '').toLowerCase()));
  }
  return rows;
}

async function backend(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (url.pathname.startsWith('/storage/')) {
    const file = path.join(photos, path.basename(url.pathname));
    return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: 'image/jpeg', headers: CORS, path: file }) : route.fulfill({ status: 404, headers: CORS });
  }
  if (url.pathname.startsWith('/rest/v1/properties')) {
    const rows = filterRows(url.searchParams);
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `*/${rows.length}` } });
    if ((req.headers().accept ?? '').includes('vnd.pgrst.object')) return json(route, rows[0] ?? null);
    return json(route, rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
  }
  if (url.pathname.startsWith('/rest/v1/profiles')) {
    const row = { ...AGENT, role: 'agent' };
    return (req.headers().accept ?? '').includes('vnd.pgrst.object') ? json(route, row) : json(route, [row]);
  }
  if (url.pathname.startsWith('/rest/v1/')) return req.method() === 'GET' || req.method() === 'HEAD' ? json(route, []) : route.fulfill({ status: 204, headers: CORS });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 401, contentType: 'application/json', headers: CORS, body: '{"msg":"no session"}' });
  return route.fulfill({ status: 503, contentType: 'application/json', headers: CORS, body: '{"error":"unavailable"}' });
}

const server = spawn(process.execPath, [path.join(repo, 'scripts/expo-web/serve.cjs'), exportDir, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: theme, locale: 'sq-AL' });
await context.addInitScript(([t]) => {
  localStorage.setItem('fho_lang', 'sq');
  localStorage.setItem('fho_theme_v2', t);
}, [theme]);
await context.routeWebSocket(/supabase\.co/, () => {});
await context.route(/\.supabase\.co\//, backend);
const page = await context.newPage();
const base = `http://localhost:${PORT}`;
const settle = (ms = 2500) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const scrollBy = async (dy) => { await page.mouse.move(215, 600); await page.mouse.wheel(0, dy); await settle(1200); };

try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await settle(3500);
  await shot('home');
  await scrollBy(700);
  await shot('home-scrolled');

  await page.goto(`${base}/explore`, { waitUntil: 'networkidle' });
  await settle();
  await shot('explore');
  await page.getByRole('button', { name: 'Filtrat' }).first().click();
  await settle(1500);
  await shot('filters');
  await page.keyboard.press('Escape');
  await page.goto(`${base}/explore`, { waitUntil: 'networkidle' });
  await settle();
  await page.getByRole('button', { name: 'Pamja e hartës' }).first().click();
  await settle(5000);
  await shot('map');

  for (const [i, l] of [LISTINGS[1], LISTINGS[0]].entries()) {
    await page.goto(`${base}/property/${l.id}`, { waitUntil: 'networkidle' });
    await settle(3500);
    await shot(`detail-${i + 1}`);
    await scrollBy(520);
    await shot(`detail-${i + 1}-scrolled`);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Saved to ${out}`);

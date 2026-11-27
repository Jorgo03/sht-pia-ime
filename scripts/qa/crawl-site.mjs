// Read-only crawl of a running website: every public route at two widths.
// Reports page/console errors, failed requests, raw i18n keys, sideways
// scroll, images without alt, page titles and links that lead nowhere.
// Usage: node scripts/qa/crawl-site.mjs <base-url>
import { chromium } from '@playwright/test';

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('usage: node scripts/qa/crawl-site.mjs <base-url>'); process.exit(1); }
const ROUTES = ['/', '/search', '/search?deal=rent', '/agents', '/wanted', '/guide', '/pricing', '/login', '/signup',
  '/forgot-password', '/favorites', '/compare', '/account', '/messages', '/viewings', '/saved-searches', '/notifications',
  '/my-listings', '/listing/new', '/agent-dashboard', '/leads', '/performance', '/blocked-users', '/moderation',
  '/assistant', '/listing/import', '/privacy', '/terms', '/cookies', '/no-such-page', '/property/00000000-0000-0000-0000-000000000000'];
const WIDTHS = [[1440, 900], [390, 844]];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const report = [];
const links = new Set();
for (const [w, h] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    const issues = [];
    page.removeAllListeners('pageerror'); page.removeAllListeners('console'); page.removeAllListeners('response');
    page.on('pageerror', (e) => issues.push('pageerror: ' + e.message.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(m.type() + ': ' + m.text().slice(0, 200)); });
    page.on('response', (res) => { if (res.status() >= 400) issues.push(`http ${res.status()} ${res.url().slice(0, 160)}`); });
    let status = 0;
    try {
      const resp = await page.goto(base + r, { waitUntil: 'networkidle', timeout: 30000 });
      status = resp?.status() ?? 0;
    } catch (e) { issues.push('goto: ' + e.message.slice(0, 120)); }
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const text = document.body.innerText;
      const rawKeys = [...new Set(text.match(/\b(?:web|common|site|auth|profile|property|filters|listing|home)\.[a-zA-Z_.]+[a-zA-Z]\b/g) || [])].slice(0, 10);
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(0, 80)).slice(0, 5);
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(0, 100)).slice(0, 5);
      const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
      const unnamed = [...document.querySelectorAll('button, a[href], input, select, textarea')].filter((el) => {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
        if (el.tagName === 'INPUT' && (el.type === 'hidden')) return false;
        const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.innerText?.trim() || el.title || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label') || el.querySelector('img[alt]:not([alt=""])');
        return !name;
      }).map((el) => el.outerHTML.slice(0, 120)).slice(0, 5);
      const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed'; }).map((el) => el.tagName + '.' + (el.className?.baseVal ?? el.className)).slice(0, 4);
      return { title: document.title, lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length, rawKeys, overflow, noAlt, broken, hrefs, unnamed, wide,
        desc: document.querySelector('meta[name=description]')?.content?.slice(0, 60) };
    });
    info.hrefs.forEach((x) => x && x.startsWith('/') && links.add(x.split('#')[0]));
    delete info.hrefs;
    report.push({ w, r, status, ...info, issues: [...new Set(issues)] });
  }
  await ctx.close();
}
// Internal links: every one should answer 200.
const linkStatus = [];
for (const l of [...links].sort()) {
  const res = await fetch(base + l, { redirect: 'manual' });
  if (res.status >= 400) linkStatus.push(`${res.status} ${l}`);
}
await browser.close();
for (const x of report) {
  const flags = [];
  if (x.status >= 400) flags.push('status ' + x.status);
  if (x.rawKeys.length) flags.push('rawKeys ' + x.rawKeys.join(','));
  if (x.overflow > 0) flags.push('overflow ' + x.overflow + ' ' + x.wide.join(' '));
  if (x.noAlt.length) flags.push('noAlt ' + x.noAlt.join(' '));
  if (x.broken.length) flags.push('brokenImg ' + x.broken.join(' '));
  if (x.unnamed.length) flags.push('unnamed ' + x.unnamed.join(' | '));
  if (x.h1 !== 1) flags.push('h1 count ' + x.h1);
  console.log(`${x.w} ${x.r} [${x.title}] ${flags.join(' ; ')}`);
  for (const i of x.issues) console.log('    ' + i);
}
console.log('internal links checked:', links.size, 'bad:', linkStatus.join(', ') || 'none');

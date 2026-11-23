// Screenshots of a running website at the restyle's four widths, for
// before/after comparison (TODO.md). Usage:
//   node scripts/qa/capture-site.mjs <base-url> <out-dir>
// Read-only: it only opens public pages.
import { chromium } from '@playwright/test';

const [base, out] = process.argv.slice(2);
if (!base || !out) {
  console.error('usage: node scripts/qa/capture-site.mjs <base-url> <out-dir>');
  process.exit(1);
}
const PAGES = [
  ['home', '/'],
  ['explore', '/explore'],
  ['wanted', '/wanted'],
  ['agents', '/agents'],
  ['guide', '/guide'],
];
const WIDTHS = [[1440, 900], [1024, 768], [768, 1024], [390, 844]];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const [w, h] of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [name, path] of PAGES) {
    await page.goto(base.replace(/\/$/, '') + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}--${w}.jpg`, type: 'jpeg', quality: 60 });
  }
  await page.close();
}
await browser.close();
console.log('saved to', out);

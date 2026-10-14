// Draws the app icon, Android adaptive icon layers, splash mark, favicons and
// the link-preview image from one SVG house mark, so they always match.
//
//   node scripts/generate-brand-assets.mjs
//
// Writes into assets/images/ (phone app) and public/ (website). Uses the
// Chromium that `npm run test:e2e:install` downloads, or PW_CHROMIUM_PATH.
// A real logo from a designer should replace HOUSE below, not these PNGs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(REPO, 'assets/images');
const WEB = path.join(REPO, 'public');
const WEB_FILES = new Set(['apple-touch-icon.png', 'og-image.png']);
const font = (p) => 'data:font/ttf;base64,' + fs.readFileSync(`${REPO}/node_modules/@expo-google-fonts/${p}`).toString('base64');
const SERIF = font('newsreader/600SemiBold/Newsreader_600SemiBold.ttf');
const SANS = font('manrope/500Medium/Manrope_500Medium.ttf');

// The mark: a house with a door, in a 100x100 box. Rounded joins so it holds
// up at 48px and still looks deliberate at 1024px.
const HOUSE = 'M50 19 L85 49 H76 V81 H59 V63 H41 V81 H24 V49 H15 Z';
const house = (fill, scale = 1) => {
  const t = (1 - scale) * 50;
  return `<g transform="translate(${t} ${t}) scale(${scale})"><path d="${HOUSE}" fill="${fill}" stroke="${fill}" stroke-width="5" stroke-linejoin="round"/></g>`;
};
const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a2b"/><stop offset="1" stop-color="#e85d00"/></linearGradient></defs>`;
const svg = (body, w = 100, h = 100) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${GRAD}${body}</svg>`;

const jobs = {
  // iOS + generic icon: full bleed, no transparency (the OS rounds corners).
  'icon.png': [1024, 1024, svg(`<rect width="100" height="100" fill="url(#g)"/>${house('#fff', 0.62)}`), false],
  // Android adaptive: the system masks to a circle/squircle, so the mark sits
  // inside the 66% safe zone.
  'android-icon-background.png': [512, 512, svg(`<rect width="100" height="100" fill="url(#g)"/>`), false],
  'android-icon-foreground.png': [512, 512, svg(house('#fff', 0.42)), true],
  'android-icon-monochrome.png': [512, 512, svg(house('#000', 0.42)), true],
  // Splash: shown at 200px wide on cream / near-black, so an orange tile.
  'splash-icon.png': [1024, 1024, svg(`<rect x="8" y="8" width="84" height="84" rx="20" fill="url(#g)"/>${house('#fff', 0.52)}`), true],
  'favicon.png': [48, 48, svg(`<rect width="100" height="100" rx="22" fill="url(#g)"/>${house('#fff', 0.66)}`), true],
  // Web: apple-touch-icon (no transparency) and a scalable favicon.
  'apple-touch-icon.png': [180, 180, svg(`<rect width="100" height="100" fill="url(#g)"/>${house('#fff', 0.62)}`), false],
  // Link preview card for WhatsApp, Facebook, X, Google.
  'og-image.png': [1200, 630, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">${GRAD}
    <style>@font-face{font-family:S;src:url(${SERIF})}@font-face{font-family:M;src:url(${SANS})}</style>
    <rect width="1200" height="630" fill="#f1ede6"/>
    <rect x="96" y="215" width="200" height="200" rx="46" fill="url(#g)"/>
    <g transform="translate(96 215) scale(2)">${house('#fff', 0.6)}</g>
    <text x="340" y="322" font-family="S" font-size="104" fill="#1c1611">Shtëpia<tspan fill="#e85d00">.ime</tspan></text>
    <text x="344" y="392" font-family="M" font-size="36" fill="#5c5249">Shtëpi në shitje dhe me qira në Shqipëri</text>
  </svg>`, false],
};

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const [name, [w, h, markup, transparent]] of Object.entries(jobs)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const sized = markup.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(WEB_FILES.has(name) ? WEB : APP, name), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}
fs.writeFileSync(path.join(WEB, 'favicon.svg'), svg(`<rect width="100" height="100" rx="22" fill="url(#g)"/>${house('#fff', 0.66)}`));
await browser.close();
console.log('done', Object.keys(jobs).length + 1, 'files');

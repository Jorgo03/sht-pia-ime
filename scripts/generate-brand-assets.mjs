// Draws every app icon, Android adaptive layer, splash mark, favicon and the
// link-preview image from the logo masters in assets/brand/, so they always
// match the logo ("Dera", the door; see assets/brand/logo-guide.md).
//
//   node scripts/generate-brand-assets.mjs
//
// Writes into assets/images/ (phone app) and public/ (website). Uses the
// Chromium that `npm run test:e2e:install` downloads, or PW_CHROMIUM_PATH.
// To change the logo, change the SVGs in assets/brand/ and run this again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(REPO, 'assets/brand');
const APP = path.join(REPO, 'assets/images');
const WEB = path.join(REPO, 'public');

const master = (name) => fs.readFileSync(path.join(BRAND, name), 'utf8');
const dataUri = (name) => 'data:image/svg+xml;base64,' + Buffer.from(master(name)).toString('base64');
const font = (p) => 'data:font/ttf;base64,' + fs.readFileSync(`${REPO}/node_modules/@expo-google-fonts/${p}`).toString('base64');
const SANS = font('manrope/500Medium/Manrope_500Medium.ttf');

// [output dir, file, width, height, html, transparent]
// App icons are opaque: iOS rejects an app icon with transparency.
const img = (name, w, h) => `<img src="${dataUri(name)}" width="${w}" height="${h}" style="display:block">`;
const jobs = [
  // iPhone: light, Dark Mode (iOS 18+) and tinted variants; also the generic icon.
  [APP, 'icon-light.png', 1024, 1024, img('app-icon-light.svg', 1024, 1024), false],
  [APP, 'icon-dark.png', 1024, 1024, img('app-icon-dark.svg', 1024, 1024), false],
  [APP, 'icon-tinted.png', 1024, 1024, img('app-icon-tinted.svg', 1024, 1024), false],
  // Android adaptive icon: white layer + door inside the 66% safe zone. Android
  // has no dark-mode icon; the monochrome layer is for themed icons (13+).
  [APP, 'android-icon-background.png', 512, 512, img('android-background.svg', 512, 512), false],
  [APP, 'android-icon-foreground.png', 512, 512, img('android-foreground.svg', 512, 512), true],
  [APP, 'android-icon-monochrome.png', 512, 512, img('android-monochrome.svg', 512, 512), true],
  // Splash: the door alone; app.json supplies the light and dark backgrounds.
  [APP, 'splash-door.png', 1024, 1024, img('splash-icon.svg', 1024, 1024), true],
  // Phone app's web export, and the website's home-screen icon.
  [APP, 'favicon.png', 48, 48, img('favicon-light.svg', 48, 48), true],
  [WEB, 'apple-touch-icon.png', 180, 180, img('app-icon-light.svg', 180, 180), false],
  // Link preview card for WhatsApp, Facebook, X, Google.
  [WEB, 'og-image.png', 1200, 630, `<style>@font-face{font-family:M;src:url(${SANS})}</style>
    <div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">
      <img src="${dataUri('lockup-horizontal-light.svg')}" style="height:150px">
      <div style="font:36px M;color:#5c5249">Shtëpi në shitje dhe me qira në Shqipëri</div>
    </div>`, false],
];

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const [dir, name, w, h, html, transparent] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(dir, name), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}
// The website favicon stays vector, and switches white/black with the browser theme.
fs.copyFileSync(path.join(BRAND, 'favicon.svg'), path.join(WEB, 'favicon.svg'));
await browser.close();
console.log('done', jobs.length + 1, 'files');

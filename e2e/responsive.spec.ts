import type { Page } from '@playwright/test';

import { AGENT, LISTINGS } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// R01: screen sizes from a Galaxy Fold's 280-wide cover screen and a Flip's
// 380-tall one up to desktop, and folding/unfolding mid-session
// (AUDIT.md Pass 23). Browser-simulated sizes, not real devices.

const SIZES: [string, number, number][] = [
  ['fold-cover', 280, 653],
  ['small-phone', 320, 720],
  ['flip-cover', 360, 380],
  ['fold-open', 673, 841],
  ['desktop', 1366, 900],
];
const PATHS = ['/', '/search', `/property/${LISTINGS[0].id}`, `/agent/${AGENT.id}`, '/profile', '/my-listings', '/new-listing', '/saved-searches'];

// Controls past the screen edge, and sideways page scroll. A control inside a
// rail that scrolls on purpose is not counted; one clipped by an overflow:
// hidden box is (that is how the header's account button used to vanish).
async function offScreen(page: Page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth})`);
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button]')) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!r.width || !r.height || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      let rail = false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) rail = true;
      }
      if (!rail && (r.left < -1 || r.right > W + 1)) {
        out.push(`${(el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).trim().slice(0, 40)} ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    return out;
  });
}

test.describe('screen sizes', () => {
  test.use({ signedIn: true });
  for (const [name, width, height] of SIZES) {
    test(`R01-${name} (${width}x${height}): every control is on screen`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone project only: the size is set per test');
      await page.setViewportSize({ width, height });
      const problems: string[] = [];
      for (const path of PATHS) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        problems.push(...(await offScreen(page)).map((p) => `${path}: ${p}`));
      }
      expect(problems).toEqual([]);
    });
  }
});

test('R02 the sign-in code boxes fit a 280-wide cover screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only');
  await page.setViewportSize({ width: 280, height: 653 });
  await page.goto('/profile');
  // The six boxes are styled by .otp-inputs; measure them without walking the
  // whole sign-in flow by mounting the same markup in the page's stylesheet.
  const fits = await page.evaluate(() => {
    const host = document.querySelector('.auth-glass') ?? document.body;
    const row = document.createElement('div');
    row.className = 'otp-inputs';
    for (let i = 0; i < 6; i++) {
      const box = document.createElement('input');
      box.className = 'otp-digit';
      row.appendChild(box);
    }
    host.appendChild(row);
    const boxes = [...row.children].map((b) => b.getBoundingClientRect());
    const card = host.getBoundingClientRect();
    row.remove();
    // ~29.5px each at 280 (44 from ~384 wide up): still a comfortable digit.
    return boxes.every((b) => b.left >= card.left - 1 && b.right <= card.right + 1 && b.width >= 28);
  });
  expect(fits).toBe(true);
});

test('R03 unfolding keeps the search you typed, the page you are on and the map', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only');
  await page.setViewportSize({ width: 344, height: 882 });
  await page.goto('/search');
  const box = page.getByRole('textbox').first();
  await box.fill('Tiranë');
  await page.getByRole('button', { name: t('search.mapView') }).click();
  const map = page.locator('.leaflet-container');
  await expect(map).toBeVisible();

  await page.setViewportSize({ width: 673, height: 841 });
  await expect(page).toHaveURL(/\/search/);
  await expect(box).toHaveValue('Tiranë');
  await expect(map).toBeVisible();
  // The map fills its (480-capped) column after the resize, not its old size.
  const [mapWidth, wrapWidth] = await map.evaluate((m) => [m.clientWidth, (m.parentElement as HTMLElement).clientWidth]);
  expect(Math.abs(mapWidth - wrapWidth)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 344, height: 882 });
  await expect(box).toHaveValue('Tiranë');
  await expect(map).toBeVisible();
});

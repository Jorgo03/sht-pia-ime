import { AGENT_LISTING, LISTINGS } from '../e2e/support/fixtures';
import { axeViolations, expect, test } from '../e2e/support/test';

// axe-core on the website built from the Expo app (serious and critical
// issues), both themes, the same pages e2e/a11y.spec.ts checks on the Vite
// site. This build is meant to replace that site.
//
// KNOWN: white text on the solid orange of a selected pill (Të gjitha,
// Klient), 2.85:1. It is the brand's primary-button style and an open owner
// decision (docs/LAUNCH_TASKS.md F16; darker orange fill or dark text). The
// Vite site has the same colours on a gradient, which axe cannot measure.
// Remove this exception when the owner decides.
const KNOWN = ['color-contrast'];
const PATHS = ['/', '/explore', `/property/${AGENT_LISTING.id}`, `/property/${LISTINGS[4].id}`, '/profile', '/privacy', '/terms', '/pricing'];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    for (const path of PATHS) {
      test(`A11Y ${scheme} ${path}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        expect(await axeViolations(page, { known: KNOWN })).toEqual([]);
      });
    }
  });
}

// Pass 20: the signed-in screens had no scan at all.
const SIGNED_IN_PATHS = ['/messages', '/favorites', '/viewings', '/my-listings', '/saved-searches'];
test.describe('signed in', () => {
  test.use({ signedIn: true });
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of SIGNED_IN_PATHS) {
      test(`A11Y signed in ${scheme} ${path}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        expect(await axeViolations(page, { known: KNOWN })).toEqual([]);
      });
    }
  }
});

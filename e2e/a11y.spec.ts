import { AGENT_LISTING, LISTINGS } from './support/fixtures';
import { axeViolations, expect, test } from './support/test';

// axe-core on every main screen, serious and critical issues only, in both
// themes. The rules in KNOWN are open bugs in replica/bugs.md; delete one from
// this list once it is fixed, so it can never come back unnoticed.
// BUG-008 (color-contrast) was fixed on 2026-10-21 with a text-only orange,
// --fho-orange-text, and is no longer listed.
const KNOWN: string[] = [];

const PATHS = ['/', '/search', `/property/${AGENT_LISTING.id}`, `/property/${LISTINGS[4].id}`, '/profile', '/privacy', '/terms', '/pricing'];

for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        try {
          localStorage.setItem('fho_theme', value);
        } catch {
          // storage blocked: the app falls back to its default theme
        }
      }, theme);
    });

    for (const path of PATHS) {
      test(`A11Y ${theme} ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await axeViolations(page, { known: KNOWN })).toEqual([]);
      });
    }
  });
}

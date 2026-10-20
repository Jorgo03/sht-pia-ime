import { AGENT_LISTING, LISTINGS } from './support/fixtures';
import { axeViolations, expect, test } from './support/test';

// axe-core on every main screen, serious and critical issues only. The rules
// in KNOWN are open bugs in replica/bugs.md; delete one from this list once it
// is fixed, so it can never come back unnoticed.
const KNOWN = [
  'color-contrast', // BUG-008: muted text fixed; brand-orange text on cream (prices, headline accents) is an open owner decision
];

for (const path of ['/', '/search', `/property/${AGENT_LISTING.id}`, `/property/${LISTINGS[4].id}`, '/profile', '/privacy', '/terms']) {
  test(`A11Y ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await axeViolations(page, { known: KNOWN })).toEqual([]);
  });
}

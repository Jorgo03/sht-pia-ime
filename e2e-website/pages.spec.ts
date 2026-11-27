import { axeViolations, expect, test } from '../e2e/support/test';
import { AGENT_LISTING, CONVERSATIONS, MISSING_ID } from '../e2e/support/fixtures';

// Every page of the website, signed out and signed in as the fixtures' agent:
// it opens without a page or console error (the shared guard), shows a main
// heading, never scrolls sideways, and has no serious accessibility issue.

const PUBLIC = ['/', '/search', '/search?deal=rent', '/agents', '/wanted', '/guide', '/pricing', '/compare',
  '/login', '/signup', '/forgot-password', `/property/${AGENT_LISTING.id}`, `/property/${MISSING_ID}`, '/property/not-a-uuid', '/no-such-page'];

const SIGNED_IN = ['/account', '/favorites', '/messages', `/messages/${CONVERSATIONS[0].id}`, '/viewings', '/saved-searches',
  '/notifications', '/my-listings', '/listing/new', `/listing/${AGENT_LISTING.id}/edit`, `/listing/${AGENT_LISTING.id}/analytics`,
  '/agent-dashboard', '/leads', '/performance', '/blocked-users', '/listing/import', '/wanted', '/compare', `/agent/${AGENT_LISTING.agent_id}`];

async function checkPage(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
  // No skeleton left behind once the page has settled.
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  // The sign-in screens draw their dusk sky as an image, which axe cannot
  // read, so it measures their light text against white. Their contrast is
  // checked directly in the test below instead.
  const known = AUTH.includes(path) ? ['color-contrast'] : [];
  expect(await axeViolations(page, { known }), `${path} accessibility`).toEqual([]);
}

const AUTH = ['/login', '/signup', '/forgot-password'];

test.describe('signed out', () => {
  for (const path of PUBLIC.filter((p) => p !== '/no-such-page')) test(`opens ${path}`, async ({ page }) => checkPage(page, path));
});

test.describe('an address that does not exist', () => {
  // The server answers 404 on purpose (404.html), and Chrome logs that.
  test.use({ allowConsoleErrors: [/status of 404/] });
  test('shows the site not-found page', async ({ page }) => {
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await checkPage(page, '/no-such-page');
  });
});

test.describe('signed in as an agent', () => {
  test.use({ signedIn: true });
  for (const path of SIGNED_IN) test(`opens ${path}`, async ({ page }) => checkPage(page, path));
});

test('sign-in: dark text on the orange button and the chosen role', async ({ page }) => {
  await page.goto('/login');
  const ink = 'rgb(20, 20, 20)';
  await expect(page.locator('.a-cta').first()).toHaveCSS('color', ink);
  await expect(page.locator('.a-roles button.is-on')).toHaveCSS('color', ink);
});

test.describe('listing form on a phone', () => {
  test.use({ signedIn: true, viewport: { width: 360, height: 740 } });
  test('the action bar is not covered by the Era button', async ({ page }) => {
    await page.goto('/listing/new');
    const bar = page.locator('.nl-bar');
    await expect(bar).toBeVisible();
    for (const button of await bar.locator('button:visible').all()) {
      const box = (await button.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest('.nl-bar') ? 'bar' : el?.className?.toString() ?? 'nothing';
      }, [box.x + box.width / 2, box.y + box.height / 2] as const);
      expect(hit, `${await button.innerText()} is covered`).toBe('bar');
    }
  });
});

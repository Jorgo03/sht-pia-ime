import { LISTINGS } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// F01: browsing and searching (replica/test-plan.md).

test('F01-H1 home shows the listings', async ({ page }) => {
  await page.goto('/');
  for (const listing of LISTINGS) {
    await expect(page.getByRole('heading', { name: listing.title, level: 3 }).first()).toBeVisible();
  }
});

test('F01-H2 search lists every active listing', async ({ page }) => {
  await page.goto('/search');
  for (const listing of LISTINGS) {
    await expect(page.getByRole('button', { name: listing.title, exact: true })).toBeVisible();
  }
});

test('F01-H3 opening a card goes to its detail page', async ({ page }) => {
  const listing = LISTINGS[1];
  await page.goto('/search');
  await page.getByRole('button', { name: listing.title, exact: true }).click();
  await expect(page).toHaveURL(`/property/${listing.id}`);
  await expect(page.getByRole('heading', { name: listing.title, level: 1 })).toBeVisible();
});

test('F01-E1 search still answers when the AI search is down', async ({ page }) => {
  await page.goto('/search');
  const box = page.getByRole('textbox');
  await box.fill('Durrës');
  await box.press('Enter');
  // ai-parse-search answers 503 in the mock; the page must fall back to a
  // plain search instead of hanging or showing nothing.
  await expect(page.getByRole('button', { name: 'Apartament pranë plazhit', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vilë me oborr në Sauk', exact: true })).toBeHidden();
});

test('F01-E2 no page scrolls sideways on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  for (const path of ['/', '/search', `/property/${LISTINGS[0].id}`, `/property/${LISTINGS[4].id}`, '/profile', '/privacy']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);
  }
});

test('F03-N1 saving a favourite from a card while signed out goes to sign-in', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('button', { name: t('common.save') }).first().click();
  await expect(page).toHaveURL('/profile');
});

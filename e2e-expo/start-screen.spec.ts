import type { Page } from '@playwright/test';

import { t } from '../e2e/support/i18n';
import { expect, test } from '../e2e/support/test';

// Where the app opens (src/features/auth/lib/startScreen.js). On phones a
// signed-out launch goes to /profile?start=1 (components/auth/signed-out-start.tsx;
// the decision itself is unit-tested in tests/startScreen.test.mjs, since this
// suite runs the website, where visitors still land on Home). Here: the
// sign-in screen opened that way, its "Browse without an account" link, and
// Home after signing in. Fake backend, offline.

async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
}

const browse = (page: Page) => page.getByRole('button', { name: t('auth.browseWithoutAccount') });

test('S1 the website still opens on Home for a signed-out visitor', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(browse(page)).toHaveCount(0);
});

test('S2 the sign-in screen as first screen offers browsing, which goes Home and does not come back', async ({ page }) => {
  await page.goto('/profile?start=1');
  await ready(page);
  await expect(page.getByRole('button', { name: t('auth.stepInside') })).toBeVisible();
  await browse(page).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('tab', { name: t('common.profile'), exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('button', { name: t('auth.stepInside') })).toBeVisible();
  await expect(browse(page)).toHaveCount(0);
});

test('S3 the Profile tab on its own shows no browse link', async ({ page }) => {
  await page.goto('/profile');
  await ready(page);
  await expect(page.getByRole('button', { name: t('auth.stepInside') })).toBeVisible();
  await expect(browse(page)).toHaveCount(0);
});

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('S4 once signed in, the first-screen sign-in goes on to Home', async ({ page }) => {
    await page.goto('/profile?start=1');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(browse(page)).toHaveCount(0);
  });
});

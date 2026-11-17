import { t } from './support/i18n';
import { expect, test } from './support/test';

// F04-N1, F05-N1, F06-N1: pages that need an account send a signed-out
// visitor to sign in, instead of showing an empty or broken screen.

for (const path of ['/messages', '/favorites', '/new-listing', '/my-listings', '/viewings', '/saved-searches', '/agent-dashboard']) {
  test(`signed out, ${path} goes to sign-in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL('/profile');
  });
}

test('the header person icon opens sign-in', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('banner').getByRole('button', { name: t('common.signIn') }).click();
  await expect(page).toHaveURL('/profile');
});

test('F04-N2 a wrong password shows an error, not a crash', async ({ page }) => {
  await page.goto('/profile');
  await page.getByPlaceholder(t('auth.email')).fill('nobody@example.com');
  const password = page.getByPlaceholder(t('auth.password'));
  await password.fill('wrong-password');
  await password.press('Enter');
  // The mock rejects every sign-in the way Supabase does for a bad password.
  await expect(page.getByRole('status').filter({ hasText: t('errors.invalidCredentials') })).toBeVisible();
  await expect(page).toHaveURL('/profile');
});

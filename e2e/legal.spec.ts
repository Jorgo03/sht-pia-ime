import { t } from './support/i18n';
import { expect, test } from './support/test';

// F09: the privacy policy and terms are public pages, linked from Home.
// Google's OAuth brand check and both app stores fetch them.

test('F09-H1 home links to both legal pages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: t('legal.privacyPolicy') }).click();
  await expect(page).toHaveURL('/privacy');
  await expect(page.getByRole('heading', { name: t('legal.privacyPolicy'), level: 1 })).toBeVisible();
  await page.getByRole('link', { name: t('legal.termsOfService') }).click();
  await expect(page).toHaveURL('/terms');
  await expect(page.getByRole('heading', { name: t('legal.termsOfService'), level: 1 })).toBeVisible();
});

test.describe('in German', () => {
  test.use({ language: 'de' });

  test('F09-E1 a language without its own text says the English one is shown', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: t('legal.privacyPolicy', 'de'), level: 1 })).toBeVisible();
    await expect(page.getByText(t('legal.languageNote', 'de'))).toBeVisible();
  });
});

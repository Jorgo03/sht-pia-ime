import { t } from './support/i18n';
import { expect, test } from './support/test';

// F08: language and theme are the visitor's choice and survive a reload.

test('F08-H1 switching to English sticks after a reload', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('button', { name: 'Shqip' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: t('search.filters', 'en') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
});

test('F08-H2 the theme toggle sticks after a reload', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByRole('button', { name: t('common.toggleTheme') }).click();
  await expect(html).not.toHaveAttribute('data-theme', before ?? '');
  const after = await html.getAttribute('data-theme');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after!);
});

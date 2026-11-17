import { t } from './support/i18n';
import { axeViolations, expect, test } from './support/test';

// F15: the website pricing page. Checkout is off in this build
// (VITE_CHECKOUT_ENABLED unset), which is what production runs until the
// owner sets prices and a payment provider.

test('F15-H1 with no prices yet the page says so, without errors', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: t('pricing.title') })).toBeVisible();
  await expect(page.getByText(t('pricing.comingSoon'))).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

test('F15-H2 prices are grouped per plan with their periods; buying is off', async ({ page, writes }) => {
  await page.route('**/rest/v1/plans*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([
        { id: 'pro_1', kind: 'agency_subscription', tier: 'pro', period_months: 1, price_cents: 249000, currency: 'ALL', name_i18n: { sq: 'Pro' }, listing_cap: 50, promotion_credits: 3, active: true, sort_order: 0 },
        { id: 'pro_12', kind: 'agency_subscription', tier: 'pro', period_months: 12, price_cents: 2490000, currency: 'ALL', name_i18n: { sq: 'Pro' }, listing_cap: 50, promotion_credits: 3, active: true, sort_order: 0 },
      ]),
    }),
  );
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pro', level: 2 })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(2);
  await page.getByRole('radio', { name: t('pricing.months').replace('{{n}}', '12') }).click();
  await expect(page.getByText(t('pricing.listingCap').replace('{{n}}', '50'))).toBeVisible();
  await expect(page.getByText(t('pricing.notYet'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('pricing.buy') })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('F15-E1 coming back from the payment page never claims the plan is active', async ({ page }) => {
  await page.goto('/pricing?checkout=done');
  await expect(page.getByRole('status')).toHaveText(t('pricing.returnedDone'));
  await page.goto('/pricing?checkout=cancelled');
  await expect(page.getByRole('status')).toHaveText(t('pricing.returnedCancelled'));
});

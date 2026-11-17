import { LISTINGS, SAVED_SEARCHES } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// F11: saved searches show how many more listings match than last time
// (docs/LAUNCH_TASKS.md L06). There is no email or push sender, so the app
// must not promise one; the count is shown in the app instead.

test.use({ signedIn: true });

const search = SAVED_SEARCHES[0];
const matchingNow = LISTINGS.filter((l) => l.status === 'active' && l.city === search.filters.city && l.listing_type === search.filters.listing_type).length;

test('F11-H1 the new-match count shows, and opening the search records it as seen', async ({ page, writes }) => {
  await page.goto('/saved-searches');
  await expect(page.getByText(t('saved.alertsHint'))).toBeVisible();
  const expected = t('saved.newMatches').replace('{{n}}', String(matchingNow - search.last_match_count));
  await expect(page.getByRole('status').filter({ hasText: expected })).toBeVisible();

  await page.getByRole('button', { name: t('saved.run') }).click();
  await expect(page).toHaveURL(/\/search\?city=Tiran%C3%AB&listing=sale/);
  const seen = writes.find((w) => w.table === 'saved_searches' && w.method === 'PATCH');
  expect(seen?.query).toContain(`id=eq.${search.id}`);
  expect(seen?.body).toEqual({ last_match_count: matchingNow });
});

test('F11-H2 the bell says what it does', async ({ page }) => {
  await page.goto('/saved-searches');
  await expect(page.getByRole('button', { name: t('saved.alertsOff') })).toBeVisible();
});

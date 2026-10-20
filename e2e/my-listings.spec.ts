import { AGENT_LISTING, OWNER_LISTINGS } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// F09: an agent edits a listing they own and closes it once it has sold.
// Signed in as the fixtures' agent; the mock records what the app saves.

test.use({ signedIn: true });

test('F09-H1 editing a listing saves the change and keeps its photos', async ({ page, writes }) => {
  await page.goto(`/my-listings/${AGENT_LISTING.id}/edit`);
  await expect(page.getByRole('heading', { name: t('listing.editListing') })).toBeVisible();

  const title = page.getByPlaceholder(t('listing.titlePlaceholder'));
  await expect(title).toHaveValue(AGENT_LISTING.title);
  await title.fill('Apartament 2+1 i rinovuar');

  // Location, details and media are already filled in: every step passes.
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: t('listing.next') }).click();

  await expect(page.getByRole('button', { name: t('listing.saveDraft') })).toHaveCount(0);
  await page.getByRole('button', { name: t('listing.saveChanges') }).click();
  await expect(page).toHaveURL('/my-listings');

  const update = writes.find((w) => w.table === 'properties' && w.method === 'PATCH');
  expect(update, 'the edit was saved').toBeTruthy();
  expect(update!.query).toContain(`id=eq.${AGENT_LISTING.id}`);
  expect(update!.body.title).toBe('Apartament 2+1 i rinovuar');
  expect(update!.body.image_urls).toEqual(AGENT_LISTING.image_urls);
  expect(update!.body.price).toBe(AGENT_LISTING.price);
  // An edit never changes who owns the listing or whether it is live.
  for (const key of ['owner_id', 'agent_id', 'owner_type', 'status']) expect(update!.body).not.toHaveProperty(key);
});

test('F09-N1 someone else\'s listing cannot be opened for editing', async ({ page, writes }) => {
  await page.goto(`/my-listings/${OWNER_LISTINGS[0].id}/edit`);
  await expect(page.getByRole('heading', { name: t('detail.unavailable') })).toBeVisible();
  await expect(page.getByPlaceholder(t('listing.titlePlaceholder'))).toHaveCount(0);
  expect(writes.filter((w) => w.table === 'properties')).toEqual([]);
});

test('F09-H2 the edit button on My Listings opens the wizard', async ({ page }) => {
  await page.goto('/my-listings');
  await page.getByRole('button', { name: t('listing.edit'), exact: true }).first().click();
  await expect(page).toHaveURL(/\/my-listings\/[^/]+\/edit$/);
  await expect(page.getByRole('heading', { name: t('listing.editListing') })).toBeVisible();
});

test('F09-H3 a sale is marked sold and a rental rented', async ({ page, writes }) => {
  await page.goto('/my-listings');
  await page.getByRole('button', { name: t('listing.markSold') }).first().click();
  await page.getByRole('button', { name: t('listing.markRented') }).first().click();
  await expect.poll(() => writes.filter((w) => w.table === 'properties').map((w) => w.body.status)).toEqual(['sold', 'rented']);
  await expect(page.getByText(t('listing.status.sold')).first()).toBeVisible();
});

test('F09-H4 a photo removed while editing is deleted from storage after saving', async ({ page, writes }) => {
  await page.goto(`/my-listings/${AGENT_LISTING.id}/edit`);
  await expect(page.getByRole('heading', { name: t('listing.editListing') })).toBeVisible();
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: t('listing.next') }).click();
  // Photos step: remove the first photo.
  await page.getByRole('button', { name: t('common.close') }).first().click();
  await page.getByRole('button', { name: t('listing.next') }).click();
  // Nothing is deleted before the save succeeds.
  expect(writes.filter((w) => w.table === 'storage')).toEqual([]);
  await page.getByRole('button', { name: t('listing.saveChanges') }).click();
  await expect(page).toHaveURL('/my-listings');

  const update = writes.find((w) => w.table === 'properties' && w.method === 'PATCH');
  expect(update!.body.image_urls).toEqual([(AGENT_LISTING.image_urls as string[])[1]]);
  const removal = writes.find((w) => w.table === 'storage' && w.method === 'DELETE');
  expect(removal?.body).toEqual({ prefixes: [`${AGENT_LISTING.agent_id}/photo-1.jpg`] });
});

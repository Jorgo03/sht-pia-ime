import { AGENT_LISTING, CONVERSATIONS, CHAT_CLIENT_ID, LISTINGS } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// F10: report a listing or a user, block a user (App Store guideline 1.2,
// Google Play user-generated content). The database enforces the rules
// (migration 20261016181934); these check what the website sends and shows.

const OTHER_LISTING = LISTINGS.find((l) => !l.agent)!;

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('F10-H1 reporting a listing sends the reason and details', async ({ page, writes }) => {
    await page.goto(`/property/${OTHER_LISTING.id}`);
    await page.getByRole('button', { name: t('safety.reportListing') }).click();
    const dialog = page.getByRole('dialog', { name: t('safety.reportListing') });
    await expect(dialog).toBeVisible();
    // Nothing can be sent until a reason is picked.
    await expect(dialog.getByRole('button', { name: t('safety.send') })).toBeDisabled();
    await dialog.getByRole('radio', { name: t('safety.reason.scam') }).check();
    await dialog.getByRole('textbox', { name: t('safety.detailsPlaceholder') }).fill('Photos are from another listing');
    await dialog.getByRole('button', { name: t('safety.send') }).click();
    await expect(dialog.getByRole('status')).toHaveText(t('safety.sent'));
    const report = writes.find((w) => w.table === 'content_reports');
    expect(report?.method).toBe('POST');
    // Only the columns a client may fill: never reporter_id or status.
    expect(report?.body).toEqual({ property_id: OTHER_LISTING.id, reason: 'scam', details: 'Photos are from another listing' });
  });

  test('F10-N2 there is no report link on your own listing', async ({ page }) => {
    await page.goto(`/property/${AGENT_LISTING.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: t('safety.reportListing') })).toHaveCount(0);
  });

  test('F10-H2 blocking someone in a chat, then unblocking', async ({ page, writes }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto(`/messages?c=${CONVERSATIONS[0].id}`);
    await page.getByRole('button', { name: t('safety.menu') }).click();
    await page.getByRole('menuitem', { name: t('safety.blockUser') }).click();
    await expect(page.getByText(t('safety.blocked'))).toBeVisible();
    // The message box is replaced by the banner while blocked.
    await expect(page.getByPlaceholder(t('messages.inputPlaceholder'))).toHaveCount(0);
    expect(writes.find((w) => w.table === 'user_blocks' && w.method === 'POST')?.body).toEqual({ blocked_id: CHAT_CLIENT_ID });

    await page.getByRole('button', { name: t('safety.unblockUser') }).click();
    await expect(page.getByPlaceholder(t('messages.inputPlaceholder'))).toBeVisible();
    const unblock = writes.find((w) => w.table === 'user_blocks' && w.method === 'DELETE');
    expect(unblock?.query).toContain(`blocked_id=eq.${CHAT_CLIENT_ID}`);
  });

  test('F10-H3 reporting the other person in a chat', async ({ page, writes }) => {
    await page.goto(`/messages?c=${CONVERSATIONS[0].id}`);
    await page.getByRole('button', { name: t('safety.menu') }).click();
    await page.getByRole('menuitem', { name: t('safety.reportUser') }).click();
    const dialog = page.getByRole('dialog', { name: t('safety.reportUser') });
    await dialog.getByRole('radio', { name: t('safety.reason.offensive') }).check();
    await dialog.getByRole('button', { name: t('safety.send') }).click();
    await expect(dialog.getByRole('status')).toHaveText(t('safety.sent'));
    expect(writes.find((w) => w.table === 'content_reports')?.body).toEqual({ reported_user_id: CHAT_CLIENT_ID, reason: 'offensive' });
  });
});

test('F10-N1 signed out, reporting asks you to sign in first', async ({ page, writes }) => {
  await page.goto(`/property/${OTHER_LISTING.id}`);
  await page.getByRole('button', { name: t('safety.reportListing') }).click();
  await expect(page.getByText(t('favourites.loginPrompt'))).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes.filter((w) => w.table === 'content_reports')).toEqual([]);
});

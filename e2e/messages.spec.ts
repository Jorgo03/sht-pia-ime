import { CONVERSATIONS } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// Pass 20, messaging: a thread whose messages fail to load says so and can be
// retried; it used to look exactly like an empty conversation.

test.describe('signed in', () => {
  test.use({ signedIn: true, allowConsoleErrors: [/status of 400/] });

  test('M-N1 a failed load shows an error and a retry, not "No messages yet"', async ({ page }) => {
    let fail = true;
    const asked: string[] = [];
    await page.route('**/rest/v1/messages*', (route) => {
      asked.push(route.request().url());
      return fail
        ? route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"code":"57014","message":"canceling statement due to statement timeout"}' })
        : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    });
    await page.goto(`/messages?c=${CONVERSATIONS[0].id}`);
    await expect(page.getByText(t('messages.loadFailed'))).toBeVisible();
    await expect(page.getByText(t('messages.noMessages'))).toHaveCount(0);
    // Newest first, bounded.
    expect(asked[0]).toMatch(/order=created_at\.desc/);
    expect(asked[0]).toMatch(/limit=200/);

    fail = false;
    await page.getByRole('button', { name: t('common.retry') }).click();
    await expect(page.getByText(t('messages.noMessages'))).toBeVisible();
  });
});

// Pass 20, account tools: every list a signed-in person keeps says when it
// could not be read, instead of showing "nothing here yet".
for (const [path, table] of [['/messages', 'conversations'], ['/viewings', 'viewings'], ['/saved-searches', 'saved_searches']] as const) {
  test.describe(`signed in, ${path}`, () => {
    test.use({ signedIn: true, allowConsoleErrors: [/status of 400/] });

    test(`A-N1 ${path}: a failed load offers a retry, which loads`, async ({ page }) => {
      let fail = true;
      await page.route(`**/rest/v1/${table}*`, (route) => {
        if (route.request().method() !== 'GET' || !fail) return route.fallback();
        return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"code":"57014","message":"canceling statement due to statement timeout"}' });
      });
      await page.goto(path);
      await expect(page.getByText(t('errors.loadFailed'))).toBeVisible();
      fail = false;
      await page.getByRole('button', { name: t('common.retry') }).click();
      await expect(page.getByText(t('errors.loadFailed'))).toHaveCount(0);
    });
  });
}

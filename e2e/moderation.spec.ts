import type { Page } from '@playwright/test';

import { AGENT_LISTING } from './support/fixtures';
import { t } from './support/i18n';
import { axeViolations, expect, test } from './support/test';

// F3: the moderation queue. Who is a moderator, and what a moderator may read
// and do, is enforced by the database (supabase/tests/rls_moderation*.sql);
// these check what the website shows and sends.

const CORS = { 'access-control-allow-origin': '*' };
const REPORT = {
  id: 'e2e00000-0000-4000-d000-0000000000r1',
  reason: 'scam',
  details: 'Photos are from another listing',
  status: 'open',
  created_at: '2026-10-20T09:00:00Z',
  reviewed_at: null,
  resolution_note: null,
  property_id: AGENT_LISTING.id,
  reported_user_id: null,
};

async function asModerator(page: Page, reports: unknown[] = [REPORT]) {
  await page.route('**/rest/v1/rpc/is_moderator', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: 'true' }));
  await page.route('**/rest/v1/content_reports*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(reports) }));
}

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('F3-N1 someone who is not a moderator sees no queue and no link', async ({ page }) => {
    let asked = false;
    page.on('request', (r) => { if (r.url().includes('/rest/v1/content_reports')) asked = true; });
    await page.goto('/moderation');
    await expect(page.getByText(t('moderation.notAllowed'))).toBeVisible();
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: t('favourites.title') })).toBeVisible();
    await expect(page.getByRole('button', { name: t('moderation.title') })).toHaveCount(0);
    expect(asked).toBe(false);
  });

  test('F3-H1 a moderator hides a reported listing and closes the report', async ({ page, writes }) => {
    await asModerator(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: t('moderation.title') }).click();
    await expect(page.getByRole('heading', { name: t('moderation.title'), level: 1 })).toBeVisible();
    const card = page.getByRole('listitem').filter({ hasText: REPORT.details });
    await expect(card.getByRole('heading', { name: t('safety.reason.scam') })).toBeVisible();
    await expect(card.getByRole('link', { name: AGENT_LISTING.title as string })).toBeVisible();
    expect(await axeViolations(page, { known: ['color-contrast'] })).toEqual([]);

    await card.getByRole('button', { name: t('moderation.hide') }).click();
    await expect(card.getByText(t('moderation.hiddenBadge'))).toBeVisible();
    await expect(card.getByRole('button', { name: t('moderation.restore') })).toBeVisible();

    await card.getByRole('textbox', { name: t('moderation.note') }).fill('  Fake photos  ');
    await card.getByRole('button', { name: t('moderation.markActioned') }).click();
    await expect(page.getByText(t('moderation.empty'))).toBeVisible();

    const rpcs = writes.filter((w) => w.table === 'rpc').map((w) => w.body);
    expect(rpcs).toEqual([
      { p_property: AGENT_LISTING.id, p_hide: true },
      { p_report: REPORT.id, p_status: 'actioned', p_note: 'Fake photos' },
    ]);
  });

  test.describe('when the database refuses', () => {
    // The browser logs each refused request (403) as a console error.
    test.use({ allowConsoleErrors: [/403/] });

    test('F3-E1 a refused action says so and keeps the report', async ({ page }) => {
      await asModerator(page);
      await page.route('**/rest/v1/rpc/resolve_report', (route) =>
        route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ code: '42501', message: 'moderators only' }) }));
      await page.goto('/moderation');
      const card = page.getByRole('listitem').filter({ hasText: REPORT.details });
      await card.getByRole('button', { name: t('moderation.dismiss') }).click();
      await expect(card.getByRole('alert')).toHaveText(t('moderation.actionFailed'));
      await expect(card).toBeVisible();
    });

    test('F3-E2 a failed load can be retried', async ({ page }) => {
      await asModerator(page);
      let fail = true;
      await page.route('**/rest/v1/content_reports*', (route) => (fail
        ? route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ code: '42501' }) })
        : route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify([REPORT]) })));
      await page.goto('/moderation');
      await expect(page.getByRole('alert')).toContainText(t('moderation.loadFailed'));
      fail = false;
      await page.getByRole('button', { name: t('common.retry') }).click();
      await expect(page.getByText(REPORT.details)).toBeVisible();
    });
  });

  test('F3-H2 the closed queue shows how each report was resolved', async ({ page }) => {
    await asModerator(page);
    await page.route('**/rest/v1/content_reports*', (route) => {
      const closed = new URL(route.request().url()).searchParams.get('status')?.startsWith('in.');
      const rows = closed ? [{ ...REPORT, status: 'dismissed', reviewed_at: '2026-10-21T10:00:00Z', resolution_note: 'Duplicate' }] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(rows) });
    });
    await page.goto('/moderation');
    await expect(page.getByText(t('moderation.empty'))).toBeVisible();
    await page.getByRole('tab', { name: t('moderation.queue.closed') }).click();
    await expect(page.getByText(`${t('moderation.status.dismissed')} · 21/10/2026 · Duplicate`)).toBeVisible();
    await expect(page.getByRole('button', { name: t('moderation.dismiss') })).toHaveCount(0);
  });
});

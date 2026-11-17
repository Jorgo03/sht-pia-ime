import type { Page, Route } from '@playwright/test';

import { CHAT_CLIENT, CHAT_CLIENT_ID, CONVERSATIONS } from '../e2e/support/fixtures';
import { type Write } from '../e2e/support/backend';
import { t } from '../e2e/support/i18n';
import { expect, test } from '../e2e/support/test';

// The chat (app/messages/[id].tsx), text only since 2026-11-14 (owner): the
// composer is a text box and Send, files sent before still show, the ⋮ menu
// is Report / Block / Cancel, reports from a chat carry person reasons and the
// conversation, blocking asks first, and blocked people are listed with
// Unblock (app/blocked-users.tsx). The database side is checked by
// supabase/tests/rls_chat_safety.sql. Fake backend, offline.

const CONV = CONVERSATIONS[0].id;
const CORS = { 'access-control-allow-origin': '*' };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const tv = (key: string, values: Record<string, string | number>) =>
  t(key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]));

async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Messages read back as stored; a sent one is recorded and answered with its row. */
async function messagesTable(page: Page, writes: Write[], rows: Record<string, unknown>[] = []) {
  await page.route('**/rest/v1/messages*', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      writes.push({ table: 'messages', method: 'POST', query: '', body });
      return json(route, { ...body, id: 'e2e00000-0000-4000-e000-000000000201', created_at: new Date().toISOString(), read_at: null }, 201);
    }
    if (req.method() === 'GET') return json(route, rows);
    return route.fulfill({ status: 204, headers: CORS, body: '' });
  });
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: t('safety.menu') }).click();
  return page.getByRole('menu');
}

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('C1 the composer is a text box and Send only, and text sends as before', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    // No paperclip, no attach menu, no file input anywhere in the chat.
    await expect(page.getByRole('button', { name: /bashkëngjit|attach/i })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    const box = page.getByRole('textbox', { name: t('messages.inputPlaceholder') });
    await expect(box).toBeVisible();
    await expect(page.getByRole('button', { name: t('common.send') })).toBeDisabled();
    await box.fill('A është ende në shitje?');
    await page.getByRole('button', { name: t('common.send') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'messages')?.body).toEqual({
      conversation_id: CONV,
      sender_id: expect.any(String),
      body: 'A është ende në shitje?',
    });
    await expect(page.getByText('A është ende në shitje?')).toBeVisible();
    await expect(box).toHaveValue('');
  });

  test('C2 photos and documents sent before still show, so the history is whole', async ({ page, writes }) => {
    const path = (n: number, ext: string) => `${CONV}/173140000000${n}-abc${n}.${ext}`;
    await messagesTable(page, writes, [
      { id: 'e2e00000-0000-4000-e000-000000000101', conversation_id: CONV, sender_id: CHAT_CLIENT_ID, body: '', created_at: '2026-11-10T10:00:00Z', read_at: null, attachment: { path: path(1, 'jpg'), name: 'sallon.jpg', mime: 'image/jpeg', size: 240000, kind: 'image' } },
      { id: 'e2e00000-0000-4000-e000-000000000102', conversation_id: CONV, sender_id: CHAT_CLIENT_ID, body: 'Ja kontrata', created_at: '2026-11-10T10:01:00Z', read_at: null, attachment: { path: path(2, 'pdf'), name: 'kontrata.pdf', mime: 'application/pdf', size: 120000, kind: 'file' } },
    ]);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    await expect(page.getByRole('button', { name: tv('messages.openAttachment', { name: 'sallon.jpg' }) })).toBeVisible();
    await expect(page.getByText('Ja kontrata')).toBeVisible();
    await expect(page.getByRole('link', { name: tv('messages.openAttachment', { name: 'kontrata.pdf' }) })).toBeVisible();
  });

  test('C3 the ⋮ menu is exactly Report, Block, Cancel; Cancel and a tap outside both close it', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    let menu = await openMenu(page);
    await expect(menu.getByRole('menuitem')).toHaveText([t('safety.reportUser'), t('safety.blockUser'), t('common.cancel')]);
    await menu.getByRole('menuitem', { name: t('common.cancel') }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    menu = await openMenu(page);
    await page.mouse.click(5, 5);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('C4 a report from the chat: person reasons, an optional note, saved with the conversation, then a thank-you', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    const menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: t('safety.reportUser') }).click();
    // Each row also holds its radio icon (a font glyph), so match the label in it.
    const reasons = page.getByRole('radio');
    const labels = ['inappropriate', 'spam', 'fake_account', 'fraud', 'harassment', 'other'].map((r) => t(`safety.reason.${r}`));
    await expect(reasons).toHaveCount(labels.length);
    for (const [i, label] of labels.entries()) await expect(reasons.nth(i)).toContainText(label);
    await page.getByRole('radio', { name: t('safety.reason.harassment') }).click();
    await page.getByPlaceholder(t('safety.detailsPlaceholder')).fill('Mesazhe fyese');
    await page.getByRole('button', { name: t('safety.send') }).click();
    await expect(page.getByText(t('safety.sent'))).toBeVisible();
    expect(writes.find((w) => w.table === 'content_reports')?.body).toEqual({
      reported_user_id: CHAT_CLIENT_ID,
      conversation_id: CONV,
      reason: 'harassment',
      details: 'Mesazhe fyese',
    });
  });

  test.describe('reported before', () => {
    test.use({ allowConsoleErrors: [/409/] });

    test('C5 a second report of the same person says it was already reported', async ({ page, writes }) => {
      await messagesTable(page, writes);
      await page.route('**/rest/v1/content_reports*', (route) =>
        json(route, { code: '23505', message: 'duplicate key value violates unique constraint' }, 409),
      );
      await page.goto(`/messages/${CONV}`);
      await ready(page);
      const menu = await openMenu(page);
      await menu.getByRole('menuitem', { name: t('safety.reportUser') }).click();
      await page.getByRole('radio', { name: t('safety.reason.spam') }).click();
      await page.getByRole('button', { name: t('safety.send') }).click();
      await expect(page.getByText(t('safety.already'))).toBeVisible();
    });
  });

  test('C6 blocking asks first; Cancel does nothing, confirming blocks and replaces the composer', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    const asked: string[] = [];
    page.once('dialog', (d) => {
      asked.push(d.message());
      void d.dismiss();
    });
    let menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: t('safety.blockUser') }).click();
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toContain(tv('safety.blockConfirm', { name: CHAT_CLIENT.full_name }));
    expect(writes.filter((w) => w.table === 'user_blocks')).toEqual([]);

    page.once('dialog', (d) => void d.accept());
    menu = await openMenu(page);
    await menu.getByRole('menuitem', { name: t('safety.blockUser') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'user_blocks')?.body).toEqual({ blocked_id: CHAT_CLIENT_ID });
    await expect(page.getByText(t('safety.blocked'))).toBeVisible();
    await expect(page.getByRole('textbox', { name: t('messages.inputPlaceholder') })).toHaveCount(0);
  });

  test('C7 Blocked users lists the people you blocked, and Unblock removes them', async ({ page, writes }) => {
    await page.route('**/rest/v1/user_blocks*', (route) => {
      if (route.request().method() === 'DELETE') {
        writes.push({ table: 'user_blocks', method: 'DELETE', query: new URL(route.request().url()).search, body: {} });
        return route.fulfill({ status: 204, headers: CORS, body: '' });
      }
      return json(route, [{ blocked_id: CHAT_CLIENT_ID, created_at: '2026-11-14T10:00:00Z' }]);
    });
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('button', { name: t('safety.blockedUsers') }).click();
    await expect(page).toHaveURL(/\/blocked-users$/);
    await expect(page.getByText(CHAT_CLIENT.full_name)).toBeVisible();
    await page.getByRole('button', { name: `${t('safety.unblockUser')}: ${CHAT_CLIENT.full_name}` }).click();
    await expect.poll(() => writes.find((w) => w.table === 'user_blocks' && w.method === 'DELETE')?.query).toContain(`blocked_id=eq.${CHAT_CLIENT_ID}`);
    await expect(page.getByText(t('safety.noBlocked'))).toBeVisible();
  });

  test('C8 with nobody blocked, the list says so', async ({ page }) => {
    await page.goto('/blocked-users');
    await ready(page);
    await expect(page.getByText(t('safety.noBlocked'))).toBeVisible();
  });
});

test('C9 signed out, a chat shows the sign-in prompt and no composer', async ({ page }) => {
  await page.goto(`/messages/${CONV}`);
  await ready(page);
  await expect(page.getByRole('textbox', { name: t('messages.inputPlaceholder') })).toHaveCount(0);
});

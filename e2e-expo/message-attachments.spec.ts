import type { Page, Route } from '@playwright/test';

declare const Buffer: { from(data: string | number[], encoding?: string): never; alloc(size: number, fill?: number): never };

import { CHAT_CLIENT, CHAT_CLIENT_ID, CONVERSATIONS } from '../e2e/support/fixtures';
import { SIGNED_IN_USER, type Write } from '../e2e/support/backend';
import { t } from '../e2e/support/i18n';
import { expect, test } from '../e2e/support/test';

// Photos and documents in chats (app/messages/[id].tsx; migration
// 20261111234947): pick, see it waiting, send it with or without text, see
// received files, open them, and the limits. The file goes to the private
// message-attachments bucket in the conversation's folder; the message
// records { path, name, mime, size, kind }. Fake backend, offline.

const CONV = CONVERSATIONS[0].id;
const CORS = { 'access-control-allow-origin': '*' };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const tv = (key: string, values: Record<string, string | number>) =>
  t(key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]));

async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Messages read back as stored; a sent one is recorded in writes and answered
 *  with its row, or refused with a database error. */
async function messagesTable(page: Page, writes: Write[], rows: Record<string, unknown>[] = [], refuse = false) {
  await page.route('**/rest/v1/messages*', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      writes.push({ table: 'messages', method: 'POST', query: '', body });
      // Not a policy refusal (42501), which the app reads as being blocked.
      if (refuse) return json(route, { code: '23514', message: 'violates check constraint' }, 400);
      return json(route, { ...body, id: `e2e00000-0000-4000-e000-00000000${String(rows.length + 1).padStart(4, '0')}`, created_at: new Date().toISOString(), read_at: null }, 201);
    }
    if (req.method() === 'GET') return json(route, rows);
    return route.fulfill({ status: 204, headers: CORS, body: '' });
  });
}

async function pickDocument(page: Page, file: { name: string; mimeType: string; buffer: never }) {
  await page.getByRole('button', { name: t('messages.attach') }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: t('messages.attachDocument') }).click(),
  ]);
  await chooser.setFiles(file);
}

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('A1 a document goes to the conversation folder and the message points at it, with no text needed', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    await pickDocument(page, { name: 'Kontrata e qirasë.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 provë') });
    await expect(page.getByText('Kontrata e qirasë.pdf')).toBeVisible();
    await page.getByRole('button', { name: t('common.send') }).click();

    await expect.poll(() => writes.find((w) => w.table === 'messages')?.method).toBe('POST');
    const upload = writes.find((w) => w.table === 'storage' && w.method === 'POST');
    expect(upload?.query).toMatch(new RegExp(`^/storage/v1/object/message-attachments/${CONV}/\\d+-[a-z0-9]+\\.pdf$`));
    const sent = writes.find((w) => w.table === 'messages')!.body as { body: string; attachment: Record<string, unknown> };
    expect(sent.body).toBe('');
    // The size is the bytes sent ("ë" is two in UTF-8).
    const bytes = new TextEncoder().encode('%PDF-1.4 provë').length;
    expect(sent.attachment).toMatchObject({ name: 'Kontrata e qirasë.pdf', mime: 'application/pdf', kind: 'file', size: bytes });
    expect(String(upload?.query)).toContain(String(sent.attachment.path));
    // The sent file shows in the thread, and nothing waits any more.
    await expect(page.getByRole('link', { name: tv('messages.openAttachment', { name: 'Kontrata e qirasë.pdf' }) })).toBeVisible();
    await expect(page.getByRole('button', { name: t('messages.removeAttachment') })).toHaveCount(0);
    expect(writes.filter((w) => w.table === 'storage' && w.method === 'DELETE')).toEqual([]);
  });

  test('A2 received photo and document show in the thread; the document opens through a temporary link', async ({ page }) => {
    const path = (n: number, ext: string) => `${CONV}/173140000000${n}-abc${n}.${ext}`;
    await messagesTable(page, [] as Write[], [
      { id: 'e2e00000-0000-4000-e000-000000000101', conversation_id: CONV, sender_id: CHAT_CLIENT_ID, body: '', created_at: '2026-11-10T10:00:00Z', read_at: null, attachment: { path: path(1, 'jpg'), name: 'sallon.jpg', mime: 'image/jpeg', size: 240000, kind: 'image' } },
      { id: 'e2e00000-0000-4000-e000-000000000102', conversation_id: CONV, sender_id: CHAT_CLIENT_ID, body: 'Ja kontrata', created_at: '2026-11-10T10:01:00Z', read_at: null, attachment: { path: path(2, 'pdf'), name: 'kontrata.pdf', mime: 'application/pdf', size: 120000, kind: 'file' } },
    ]);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    await expect(page.getByRole('button', { name: tv('messages.openAttachment', { name: 'sallon.jpg' }) })).toBeVisible();
    await expect(page.getByText('Ja kontrata')).toBeVisible();
    await expect(page.getByText('kontrata.pdf')).toBeVisible();
    await expect(page.getByText('117 KB')).toBeVisible();
    // The new tab asks for the temporary link (the fake backend answers only
    // this page, so the tab itself cannot load it).
    const opened: string[] = [];
    page.context().on('request', (r) => {
      if (r.url().includes('/object/sign/')) opened.push(decodeURIComponent(r.url()));
    });
    await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: tv('messages.openAttachment', { name: 'kontrata.pdf' }) }).click(),
    ]);
    await expect.poll(() => opened.some((u) => u.includes(`/storage/v1/object/sign/message-attachments/${path(2, 'pdf')}?token=`))).toBe(true);
  });

  test('A7 a photo is re-encoded as a JPEG and sent as an image', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    // A real 2x2 PNG, so the browser can decode and redraw it.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDEgARgAgPsEAHsPPYoAAAAASUVORK5CYII=',
      'base64',
    );
    await page.getByRole('button', { name: t('messages.attach') }).click();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('menuitem', { name: t('messages.attachPhoto') }).click(),
    ]);
    await chooser.setFiles({ name: 'dhoma.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByText('dhoma.jpg')).toBeVisible();
    await page.getByRole('button', { name: t('common.send') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'messages')?.method).toBe('POST');
    const upload = writes.find((w) => w.table === 'storage' && w.method === 'POST');
    expect(upload?.query).toMatch(new RegExp(`^/storage/v1/object/message-attachments/${CONV}/\\d+-[a-z0-9]+\\.jpg$`));
    expect(writes.find((w) => w.table === 'messages')!.body).toMatchObject({
      body: '',
      attachment: { name: 'dhoma.jpg', mime: 'image/jpeg', kind: 'image' },
    });
    await expect(page.getByRole('button', { name: tv('messages.openAttachment', { name: 'dhoma.jpg' }) })).toBeVisible();
  });

  test('A3 a file over 10 MB, or a type that cannot be sent, is refused before anything is uploaded', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    await pickDocument(page, { name: 'video.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1) });
    await expect(page.getByText(tv('messages.attachTooBig', { max: 10 }))).toBeVisible();
    await pickDocument(page, { name: 'faqe.html', mimeType: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') });
    await expect(page.getByText(t('messages.attachType'))).toBeVisible();
    await expect(page.getByRole('button', { name: t('messages.removeAttachment') })).toHaveCount(0);
    expect(writes.filter((w) => w.table === 'storage')).toEqual([]);
  });

  test('A4 a file can be removed before sending, and then only text goes', async ({ page, writes }) => {
    await messagesTable(page, writes);
    await page.goto(`/messages/${CONV}`);
    await ready(page);
    await pickDocument(page, { name: 'shenime.txt', mimeType: 'text/plain', buffer: Buffer.from('shënime') });
    await page.getByRole('button', { name: t('messages.removeAttachment') }).click();
    await expect(page.getByText('shenime.txt')).toHaveCount(0);
    await page.getByRole('textbox', { name: t('messages.inputPlaceholder') }).fill('Vetëm tekst');
    await page.getByRole('button', { name: t('common.send') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'messages')?.body).toMatchObject({ body: 'Vetëm tekst' });
    expect(writes.find((w) => w.table === 'messages')!.body).not.toHaveProperty('attachment');
    expect(writes.filter((w) => w.table === 'storage')).toEqual([]);
  });

  test.describe('the message is refused', () => {
    test.use({ allowConsoleErrors: [/400/] });

    test('A5 a refused message removes the file it uploaded and says so', async ({ page, writes }) => {
      await messagesTable(page, writes, [], true);
      await page.goto(`/messages/${CONV}`);
      await ready(page);
      await pickDocument(page, { name: 'oferta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
      await page.getByRole('button', { name: t('common.send') }).click();
      await expect(page.getByText(t('messages.sendFailed'))).toBeVisible();
      await expect.poll(() => writes.filter((w) => w.table === 'storage').map((w) => w.method)).toEqual(['POST', 'DELETE']);
      // Still waiting, so the person can try again.
      await expect(page.getByText('oferta.pdf')).toBeVisible();
    });
  });
});

test('A6 the attach button is only for signed-in chats (signed out sees the sign-in prompt)', async ({ page }) => {
  await page.goto(`/messages/${CONV}`);
  await ready(page);
  await expect(page.getByRole('button', { name: t('messages.attach') })).toHaveCount(0);
  expect(SIGNED_IN_USER.id).not.toBe(CHAT_CLIENT.id);
});

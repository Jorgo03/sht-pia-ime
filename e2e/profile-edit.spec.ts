import { AGENT } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// F12: a signed-in agent edits their own profile (docs/LAUNCH_TASKS.md L12).
// Only changed fields are sent, so a name change works even before the phone
// grant in supabase/pending/profile_phone_update.sql is applied.

test.use({ signedIn: true });

async function openSheet(page: import('@playwright/test').Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: t('profile.edit.title') }).click();
  const sheet = page.getByRole('dialog', { name: t('profile.edit.title') });
  await expect(sheet).toBeVisible();
  return sheet;
}

test('F12-H1 changing the name sends only the name', async ({ page, writes }) => {
  const sheet = await openSheet(page);
  const name = sheet.getByLabel(t('auth.fullName'));
  await expect(name).toHaveValue(AGENT.full_name);
  await expect(sheet.getByLabel(t('profile.edit.phone'))).toHaveValue(AGENT.phone!);
  await expect(sheet.getByLabel(t('auth.agencyName'))).toHaveValue(AGENT.agency_name!);

  await name.fill('  Arta   Hoxha ');
  await sheet.getByRole('button', { name: t('common.save') }).click();
  await expect(sheet).toHaveCount(0);

  const update = writes.filter((w) => w.table === 'profiles');
  expect(update).toHaveLength(1);
  expect(update[0].method).toBe('PATCH');
  expect(update[0].query).toContain(`id=eq.${AGENT.id}`);
  expect(update[0].body).toEqual({ full_name: 'Arta Hoxha' });
});

test('F12-H2 saving without changes sends nothing', async ({ page, writes }) => {
  const sheet = await openSheet(page);
  await sheet.getByRole('button', { name: t('common.save') }).click();
  await expect(sheet).toHaveCount(0);
  expect(writes.filter((w) => w.table === 'profiles')).toEqual([]);
});

test('F12-N1 a bad phone number or an empty name is refused before saving', async ({ page, writes }) => {
  const sheet = await openSheet(page);
  await sheet.getByLabel(t('profile.edit.phone')).fill('call me');
  await sheet.getByRole('button', { name: t('common.save') }).click();
  await expect(sheet.getByRole('alert')).toHaveText(t('profile.edit.phoneInvalid'));

  await sheet.getByLabel(t('profile.edit.phone')).fill('');
  await sheet.getByLabel(t('auth.fullName')).fill('   ');
  await sheet.getByRole('button', { name: t('common.save') }).click();
  await expect(sheet.getByRole('alert')).toHaveText(t('profile.edit.nameRequired'));
  expect(writes.filter((w) => w.table === 'profiles')).toEqual([]);
});

test.describe('refused by the database', () => {
  // The browser logs the 401 response itself; that is the case under test.
  test.use({ allowConsoleErrors: [/401/] });

  test('F12-N2 a refused save says so and keeps the sheet open', async ({ page, writes }) => {
    // What production answers today for a phone change (no column grant yet).
    await page.route('**/rest/v1/profiles*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 401,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify({ code: '42501', message: 'permission denied for table profiles' }),
          })
        : route.fallback(),
    );
    const sheet = await openSheet(page);
    await sheet.getByLabel(t('profile.edit.phone')).fill('+355 68 111 2222');
    await sheet.getByRole('button', { name: t('common.save') }).click();
    await expect(sheet.getByRole('alert')).toHaveText(t('profile.edit.failed'));
    await expect(sheet).toBeVisible();
    expect(writes.filter((w) => w.table === 'profiles')).toEqual([]);
  });
});

// A 2×1 PNG: real image bytes, so the browser decodes and re-encodes it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwyBDAYAXCQH+aNfsiAAAAAASUVORK5CYII=',
  'base64',
);

test('F12-H3 a new photo is uploaded to your own folder as a JPEG, then saved on the profile', async ({ page, writes }) => {
  const sheet = await openSheet(page);
  await sheet.getByLabel(t('profile.edit.changePhoto')).setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(sheet.getByRole('button', { name: t('profile.edit.removePhoto') })).toBeVisible();

  const upload = writes.find((w) => w.table === 'storage' && w.method === 'POST');
  expect(upload, 'the photo was uploaded').toBeTruthy();
  expect(upload!.query).toMatch(new RegExp(`^/storage/v1/object/avatars/${AGENT.id}/avatar-\\d+\\.jpg$`));
  const update = writes.find((w) => w.table === 'profiles' && w.method === 'PATCH');
  expect(update!.body).toEqual({
    avatar_url: expect.stringMatching(new RegExp(`/storage/v1/object/public/avatars/${AGENT.id}/avatar-\\d+\\.jpg$`)),
  });
});

test('F12-N3 a file that is not a photo is refused before anything is sent', async ({ page, writes }) => {
  const sheet = await openSheet(page);
  await sheet.getByLabel(t('profile.edit.changePhoto')).setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(sheet.getByRole('alert')).toHaveText(t('profile.edit.photoType'));
  expect(writes.filter((w) => w.table === 'storage' || w.table === 'profiles')).toEqual([]);
});

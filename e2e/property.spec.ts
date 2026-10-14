import { AGENT, AGENT_LISTING, LISTINGS, MISSING_ID } from './support/fixtures';
import { t } from './support/i18n';
import { axeViolations, expect, test } from './support/test';

// F02: a listing's page, and every way to reach whoever is selling it.

const strip = (page: import('@playwright/test').Page) => page.locator('.agent-strip');

test('F02-H1 agent listing: profile, chat, call and WhatsApp', async ({ page }) => {
  await page.goto(`/property/${AGENT_LISTING.id}`);
  await expect(page.getByRole('heading', { name: AGENT_LISTING.title, level: 1 })).toBeVisible();

  await expect(strip(page).getByRole('button', { name: t('detail.chatInApp') })).toBeVisible();
  await expect(strip(page).getByRole('link', { name: t('property.call') })).toHaveAttribute('href', 'tel:+355690000001');
  const whatsapp = strip(page).getByRole('link', { name: t('detail.message') });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/355690000001\?text=/);
  await expect(whatsapp).toHaveAttribute('target', '_blank');

  await strip(page).getByRole('button', { name: new RegExp(AGENT.full_name) }).click();
  await expect(page).toHaveURL(`/agent/${AGENT.id}`);
});

// BUG-001, BUG-003, BUG-007, BUG-011: owner listings had no contact at all,
// and phone numbers typed these ways produced broken links.
const OWNER_NUMBERS: Record<string, string> = {
  '0692000005': '355692000005',
  '+ 069 20 00 006': '355692000006',
  '+39 333 000 0007': '393330000007',
};

for (const listing of LISTINGS.filter((l) => !l.agent)) {
  test(`F02-H2 owner listing can be contacted (${listing.contact_phone})`, async ({ page }) => {
    const digits = OWNER_NUMBERS[listing.contact_phone!];
    await page.goto(`/property/${listing.id}`);
    await expect(strip(page).getByText(t('detail.owner'), { exact: true })).toBeVisible();
    await expect(strip(page).getByRole('link', { name: t('property.call') })).toHaveAttribute('href', `tel:+${digits}`);
    await expect(strip(page).getByRole('link', { name: t('detail.message') })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${digits}\\?text=`));
  });
}

test('F02-H3 the WhatsApp message names the listing', async ({ page }) => {
  await page.goto(`/property/${AGENT_LISTING.id}`);
  const expected = new URLSearchParams({ text: t('property.whatsappMessage').replace('{{title}}', AGENT_LISTING.title) });
  const link = strip(page).getByRole('link', { name: t('detail.message') });
  await expect(link).toHaveAttribute('href', `https://wa.me/355690000001?${expected.toString().replace(/\+/g, '%20')}`);
});

test.describe('share without a share sheet', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('F02-H4 copies the link and says so (BUG-010)', async ({ page }) => {
    await page.addInitScript(() => {
      delete (Navigator.prototype as { share?: unknown }).share;
    });
    await page.goto(`/property/${AGENT_LISTING.id}`);
    await page.getByRole('button', { name: t('detail.share') }).click();
    await expect(page.getByRole('status').filter({ hasText: t('detail.linkCopied') })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/property/${AGENT_LISTING.id}$`));
  });
});

test('F02-N1 a missing listing explains itself and offers a way on (BUG-004)', async ({ page }) => {
  await page.goto(`/property/${MISSING_ID}`);
  await expect(page.getByRole('heading', { name: t('detail.unavailable') })).toBeVisible();
  await expect(page.getByText(t('detail.unavailableHint'))).toBeVisible();
  await page.getByRole('button', { name: t('common.search'), exact: true }).click();
  await expect(page).toHaveURL('/search');
});

test('F03-N2 saving from the listing page while signed out asks you to sign in', async ({ page }) => {
  await page.goto(`/property/${AGENT_LISTING.id}`);
  await page.getByRole('button', { name: t('common.save') }).first().click();
  await expect(page.getByText(t('favourites.loginPrompt'))).toBeVisible();
});

test('F02-N2 scheduling a viewing while signed out asks you to sign in', async ({ page }) => {
  await page.goto(`/property/${AGENT_LISTING.id}`);
  await page.getByRole('button', { name: t('detail.scheduleViewing') }).click();
  await expect(page.getByText(t('favourites.loginPrompt'))).toBeVisible();
});

test('A11Y contact strip has no nested or unnamed controls (BUG-006)', async ({ page }) => {
  for (const listing of [AGENT_LISTING, LISTINGS.find((l) => !l.agent)!]) {
    await page.goto(`/property/${listing.id}`);
    await expect(strip(page)).toBeVisible();
    // color-contrast is BUG-008, tracked separately.
    expect(await axeViolations(page, { include: '.agent-strip', known: ['color-contrast'] })).toEqual([]);
  }
});

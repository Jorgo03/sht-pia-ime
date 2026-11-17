import { LISTINGS } from './support/fixtures';
import { t } from './support/i18n';
import { expect, test } from './support/test';

// F19: zone and reference-number search (docs/LAUNCH_TASKS.md). Uses the URL
// parameters the filter bar and sheet write, so it covers both widths.

const inBlloku = LISTINGS[0];
const elsewhere = LISTINGS[1];

test('F19-H1 a zone narrows a city search to that neighborhood', async ({ page }) => {
  await page.goto('/search?city=Tiran%C3%AB&zone=Blloku');
  await expect(page.getByRole('link', { name: inBlloku.title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: elsewhere.title, exact: true })).toBeHidden();
});

test('F19-E1 a zone from another city is ignored, not an empty page', async ({ page }) => {
  await page.goto('/search?city=Durr%C3%ABs&zone=Blloku');
  await expect(page.getByRole('link', { name: 'Apartament pranë plazhit', exact: true })).toBeVisible();
});

test('F19-H2 a reference finds exactly one listing, typed any common way', async ({ page }) => {
  await page.goto(`/search?ref=sh-${String(elsewhere.ref_code).toLowerCase()}`);
  await expect(page.getByRole('link', { name: elsewhere.title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: inBlloku.title, exact: true })).toBeHidden();
});

test('F19-H3 the listing page shows its zone and reference', async ({ page }) => {
  await page.goto(`/property/${inBlloku.id}`);
  await expect(page.getByText(`${t('detail.reference')} SH-${inBlloku.ref_code}`)).toBeVisible();
  await expect(page.getByText(/Blloku, Tiranë/)).toBeVisible();
});

test('F19-H4 changing the city clears the zone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the inline bar is desktop; the sheet shares the same handler');
  await page.goto('/search?city=Tiran%C3%AB&zone=Blloku');
  await page.getByRole('combobox', { name: t('search.city') }).first().selectOption('Durrës');
  await expect(page).not.toHaveURL(/zone=/);
});

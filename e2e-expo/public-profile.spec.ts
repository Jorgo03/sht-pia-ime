import type { Page } from '@playwright/test';

import { AGENT, CHAT_CLIENT, CHAT_CLIENT_ID, CONVERSATIONS, LISTINGS, OWNER_LISTINGS } from '../e2e/support/fixtures';
import { t } from '../e2e/support/i18n';
import { axeViolations, expect, test } from '../e2e/support/test';

// Public profile (app/user/[id].tsx): chat header → the other person's profile
// → their listings → a listing → back to the profile → back to the chat.
// public_profile() decides what may be shown (the fake backend applies the
// same rules as migration 20261111230117); listings are active ones only.
// Same fake backend as e2e/: offline, never touches production.

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
const AGENT_LISTINGS = LISTINGS.filter((l) => l.agent);
const OWNER_5 = LISTINGS[4];
const OWNER_5_ID = OWNER_5.owner_id as string;

/** t() with its {{values}} filled in, as i18next does. */
const tv = (key: string, values: Record<string, string | number>) =>
  t(key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]));

// Opening a profile directly keeps Home mounted underneath, with the same
// listings and the agent rail, so checks look only inside the profile.
const profile = (page: Page) => page.getByTestId('public-profile');

async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
}

const ddmmyyyy = (iso: unknown) => {
  const d = new Date(String(iso));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

test.describe('signed in as the agent', () => {
  test.use({ signedIn: true });

  test('P1 the chat header opens the other person, a client: name, phone, no office, none published; back returns to the chat', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/rpc/public_profile')) asked.push(String(r.postDataJSON()?.p_user));
    });
    await page.goto(`/messages/${CONVERSATIONS[0].id}`);
    await ready(page);
    await expect(page.getByRole('heading', { name: CHAT_CLIENT.full_name, level: 1 })).toBeVisible();

    await page.getByRole('button', { name: tv('publicProfile.open', { name: CHAT_CLIENT.full_name }) }).click();
    await expect(page).toHaveURL(new RegExp(`/user/${CHAT_CLIENT_ID}$`));
    await expect(page.getByRole('heading', { name: CHAT_CLIENT.full_name })).toBeVisible();
    await expect(page.getByText(t('auth.roleClient'), { exact: true })).toBeVisible();
    await expect(page.getByText(CHAT_CLIENT.phone)).toBeVisible();
    await expect(page.getByText(CHAT_CLIENT.agency_name)).toHaveCount(0);
    await expect(page.getByText(t('publicProfile.agent'))).toHaveCount(0);
    await expect(page.getByText(tv('publicProfile.published', { n: 0 }))).toBeVisible();
    await expect(page.getByText(t('publicProfile.empty'))).toBeVisible();
    // Only ever the other participant, never the signed-in agent.
    expect(asked).toContain(CHAT_CLIENT_ID);
    expect(asked).not.toContain(AGENT.id);

    await page.getByRole('button', { name: t('common.back') }).first().click();
    await expect(page).toHaveURL(new RegExp(`/messages/${CONVERSATIONS[0].id}$`));
    await expect(page.getByRole('heading', { name: CHAT_CLIENT.full_name, level: 1 })).toBeVisible();
  });

  test('P2 tapping the name opens the profile too; the property title still opens the listing', async ({ page }) => {
    await page.goto(`/messages/${CONVERSATIONS[0].id}`);
    await ready(page);
    await page.getByRole('heading', { name: CHAT_CLIENT.full_name, level: 1 }).click();
    await expect(page).toHaveURL(new RegExp(`/user/${CHAT_CLIENT_ID}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/messages/${CONVERSATIONS[0].id}$`));
    await page.getByRole('button', { name: LISTINGS[0].title }).click();
    await expect(page).toHaveURL(new RegExp(`/property/${LISTINGS[0].id}$`));
  });
});

test('P3 an agent: office, phone, every active listing with title and date; a card opens the listing and back returns', async ({ page }) => {
  const queries: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/properties') && r.url().includes('owner_id.eq')) queries.push(decodeURIComponent(r.url()));
  });
  await page.goto(`/user/${AGENT.id}`);
  await ready(page);
  await expect(profile(page).getByRole('heading', { name: AGENT.full_name })).toBeVisible();
  await expect(profile(page).getByText(t('publicProfile.agent'))).toBeVisible();
  await expect(profile(page).getByText(AGENT.agency_name as string)).toBeVisible();
  await expect(profile(page).getByText(AGENT.phone as string)).toBeVisible();
  await expect(profile(page).getByText(tv('publicProfile.published', { n: AGENT_LISTINGS.length }))).toBeVisible();
  await expect(profile(page).getByRole('heading', { name: t('publicProfile.listingsTitle') })).toBeVisible();
  for (const l of AGENT_LISTINGS) await expect(profile(page).getByText(l.title, { exact: true })).toBeVisible();
  for (const l of OWNER_LISTINGS) await expect(profile(page).getByText(l.title, { exact: true })).toHaveCount(0);
  await expect(profile(page).getByText(tv('property.publishedOn', { date: ddmmyyyy(AGENT_LISTINGS[0].created_at) })).first()).toBeVisible();
  // This person as publisher, active listings only, one page of 24.
  expect(queries[0]).toContain(`or=(owner_id.eq.${AGENT.id},agent_id.eq.${AGENT.id})`);
  expect(queries[0]).toContain('status=eq.active');
  expect(queries[0]).toContain('limit=24');

  await profile(page).getByText(AGENT_LISTINGS[1].title, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/property/${AGENT_LISTINGS[1].id}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/user/${AGENT.id}$`));
  await expect(profile(page).getByRole('heading', { name: AGENT.full_name })).toBeVisible();
});

test('P4 a client who publishes, seen by anyone: only their own listing, no office', async ({ page }) => {
  await page.goto(`/user/${OWNER_5_ID}`);
  await ready(page);
  await expect(profile(page).getByText(t('auth.roleClient'), { exact: true })).toBeVisible();
  await expect(profile(page).getByText(OWNER_5.contact_phone as string)).toBeVisible();
  await expect(profile(page).getByText(tv('publicProfile.published', { n: 1 }))).toBeVisible();
  await expect(profile(page).getByText(OWNER_5.title, { exact: true })).toBeVisible();
  for (const l of LISTINGS.filter((x) => x.id !== OWNER_5.id)) await expect(profile(page).getByText(l.title, { exact: true })).toHaveCount(0);
  await expect(profile(page).getByText(t('publicProfile.agent'))).toHaveCount(0);
});

test('P5 the old agent address shows the same profile, and it passes the accessibility check', async ({ page }) => {
  await page.goto(`/agent/${AGENT.id}`);
  await ready(page);
  await expect(profile(page).getByRole('heading', { name: AGENT.full_name })).toBeVisible();
  await expect(profile(page).getByText(AGENT_LISTINGS[0].title, { exact: true })).toBeVisible();
  expect(await axeViolations(page, { known: ['color-contrast'] })).toEqual([]);
});

test('P6 a profile that may not be shown, or an address that is not an id, says so; a bad id asks nothing', async ({ page }) => {
  let rpcCalls = 0;
  page.on('request', (r) => {
    if (r.url().includes('/rpc/public_profile')) rpcCalls++;
  });
  await page.goto('/user/e2e00000-0000-4000-c000-00000000dead');
  await ready(page);
  await expect(page.getByText(t('publicProfile.unavailable'))).toBeVisible();
  expect(rpcCalls).toBe(1);
  await page.goto('/user/not-an-id');
  await ready(page);
  await expect(page.getByText(t('publicProfile.unavailable'))).toBeVisible();
  expect(rpcCalls).toBe(1);
});

test('P7 more than 24 listings: a page at a time, Load more appends the rest', async ({ page }) => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    ...LISTINGS[0],
    id: `e2e00000-0000-4000-b000-${String(900 + i).padStart(12, '0')}`,
    title: `Prona ${i + 1}`,
    created_at: `2026-09-${String(30 - i).padStart(2, '0')}T10:00:00+00:00`,
  }));
  await page.route(`**/rest/v1/properties*owner_id.eq.${AGENT.id}*`, (route) => {
    const u = new URL(route.request().url());
    const offset = Number(u.searchParams.get('offset') ?? 0);
    const limit = Number(u.searchParams.get('limit') ?? 24);
    const rows = many.slice(offset, offset + limit);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ...CORS, 'content-range': `${offset}-${offset + rows.length - 1}/${many.length}` },
      body: JSON.stringify(rows),
    });
  });
  await page.goto(`/user/${AGENT.id}`);
  await ready(page);
  await expect(profile(page).getByText('Prona 24', { exact: true })).toBeAttached();
  await expect(profile(page).getByText('Prona 25', { exact: true })).toHaveCount(0);
  await expect(profile(page).getByText(tv('publicProfile.published', { n: 30 }))).toBeVisible();
  await page.getByRole('button', { name: t('agents.loadMore') }).click();
  await expect(profile(page).getByText('Prona 30', { exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: t('agents.loadMore') })).toHaveCount(0);
});

test.describe('listings that fail', () => {
  // A dropped connection, not a 5xx: the harness fails every 5xx on purpose.
  test.use({ allowConsoleErrors: [/Failed to load resource|ERR_FAILED|Network request failed|TypeError: Failed to fetch/] });

  test('P8 listings that fail to load offer a retry instead of "none published"', async ({ page }) => {
    let fail = true;
    await page.route(`**/rest/v1/properties*owner_id.eq.${AGENT.id}*`, (route) =>
      fail ? route.abort('failed') : route.fallback(),
    );
    await page.goto(`/user/${AGENT.id}`);
    await ready(page);
    // supabase-js retries a dropped read 3 times (1 s, 2 s, 4 s) before giving up.
    await expect(profile(page).getByText(t('publicProfile.listingsFailed'))).toBeVisible({ timeout: 15_000 });
    await expect(profile(page).getByText(t('publicProfile.empty'))).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: t('common.retry') }).click();
    await expect(profile(page).getByText(AGENT_LISTINGS[0].title, { exact: true })).toBeVisible();
  });
});

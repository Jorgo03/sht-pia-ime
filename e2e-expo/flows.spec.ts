import type { Page, Route } from '@playwright/test';

import { CHAT_CLIENT_ID, CONVERSATIONS, LISTINGS } from '../e2e/support/fixtures';
import { fakeSession, SIGNED_IN_USER } from '../e2e/support/backend';
import { t } from '../e2e/support/i18n';
import { axeViolations, expect, test } from '../e2e/support/test';

// The main flows on the website built from the Expo app (DECISIONS.md W1,
// stage 1): browse, search and filters, sign-in, favourites, profile and
// sign-out, language, messaging, legal pages and the old Vite addresses.
// Same fake backend as e2e/: offline, never touches production.

const CORS = { 'access-control-allow-origin': '*' };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

const FEATURED = LISTINGS[0];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function ready(page: Page) {
  await page.waitForLoadState('networkidle');
}

test('X01 browse: the home page lists listings and a title opens the listing', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: FEATURED.title as string }).first().click();
  await expect(page).toHaveURL(new RegExp(`/property/${FEATURED.id}$`));
  await expect(page.getByRole('heading', { name: FEATURED.title as string, level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(`^${escape(FEATURED.title as string)} - ${FEATURED.city} \\| Shtëpia\\.ime$`));
});

test('X02 search: Sale/Rent pills and the search box narrow the results', async ({ page }) => {
  await page.goto('/explore');
  await ready(page);
  // "7 prona në shikim" / "1 pronë në shikim"
  const count = page.getByText(/në shikim/);
  await expect(count).toContainText(String(LISTINGS.length));
  await page.getByRole('button', { name: t('search.rent'), exact: true }).click();
  const rentals = LISTINGS.filter((l) => l.listing_type === 'rent').length;
  await expect(count).toContainText(String(rentals));
  await page.getByRole('button', { name: t('common.all'), exact: true }).click();
  await expect(count).toContainText(String(LISTINGS.length));
});

test('X03 sign in with email and password', async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route('**/auth/v1/token*', (route) => {
    sent = route.request().postDataJSON();
    return json(route, fakeSession());
  });
  await page.route('**/auth/v1/user*', (route) => json(route, SIGNED_IN_USER));
  await page.goto('/profile');
  await ready(page);
  await page.getByRole('textbox', { name: t('auth.email') }).fill('agent@example.com');
  await page.getByRole('textbox', { name: t('auth.password') }).fill('correct-horse-battery');
  await page.getByRole('button', { name: t('auth.stepInside') }).click();
  await expect(page.getByRole('heading', { name: t('common.profile'), level: 1 })).toBeVisible();
  expect(sent).toMatchObject({ email: 'agent@example.com', password: 'correct-horse-battery' });
});

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('X04 favourites: the heart saves a listing for this account', async ({ page, writes }) => {
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: t('common.save') }).first().click();
    await expect.poll(() => writes.find((w) => w.table === 'favorites')?.method).toBe('POST');
    expect(writes.find((w) => w.table === 'favorites')?.body).toMatchObject({ user_id: SIGNED_IN_USER.id });
  });

  test('X05 profile: menu rows, then sign out asks first', async ({ page }) => {
    await page.goto('/profile');
    await ready(page);
    await expect(page.getByRole('heading', { name: t('common.profile'), level: 1 })).toBeVisible();
    for (const label of [t('profile.edit.title'), t('notifications.title'), t('listing.myListings')]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
    await page.getByRole('button', { name: t('common.signOut') }).first().click();
    await expect(page.getByText(t('common.confirmSignOut'))).toBeVisible();
    await page.getByRole('button', { name: t('common.signOut') }).last().click();
    await expect(page.getByRole('textbox', { name: t('auth.email') })).toBeVisible();
  });

  test('X06 messaging: open a conversation and send a message', async ({ page, writes }) => {
    // The real database lets the agent read the client's profile (they share
    // a conversation); the shared fake backend only knows agents.
    await page.route(`**/rest/v1/profiles*id=eq.${CHAT_CLIENT_ID}*`, (route) =>
      json(route, { full_name: 'Ana Klientja', agency_name: null }),
    );
    await page.goto('/messages');
    await ready(page);
    await page.getByRole('button', { name: new RegExp(escape(LISTINGS[0].title as string)) }).click();
    await expect(page).toHaveURL(new RegExp(`/messages/${CONVERSATIONS[0].id}$`));
    await expect(page.getByRole('heading', { name: 'Ana Klientja', level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: t('messages.inputPlaceholder') }).fill('Përshëndetje, a është ende në shitje?');
    await page.getByRole('button', { name: t('common.send') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'messages')?.method).toBe('POST');
    expect(writes.find((w) => w.table === 'messages')?.body).toMatchObject({
      conversation_id: CONVERSATIONS[0].id,
      body: 'Përshëndetje, a është ende në shitje?',
    });
  });
});

test('X07 language: switching to English sticks after a reload', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: t('common.language') }).click();
  await page.getByRole('button', { name: /English/ }).click();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  // Screen readers pick their voice from <html lang>.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('X08 legal pages: reachable from Profile, each links to the other', async ({ page }) => {
  await page.goto('/profile');
  await ready(page);
  await page.getByRole('link', { name: t('legal.privacyPolicy') }).first().click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { name: t('legal.privacyPolicy'), level: 1 })).toBeVisible();
  await page.getByRole('link', { name: t('legal.termsOfService') }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page).toHaveTitle(new RegExp(t('legal.termsOfService')));
});

test('X09 old website addresses redirect to the new ones', async ({ page }) => {
  await page.goto('/search');
  await expect(page).toHaveURL(/\/explore$/);
  await page.goto(`/my-listings/${FEATURED.id}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/listing/${FEATURED.id}/analytics$`));
});

test('X10 a wide screen shows the app as a phone-width column', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await page.goto('/');
  await ready(page);
  const tabs = await page.getByRole('tablist').boundingBox();
  expect(tabs).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(tabs!.width).toBeLessThanOrEqual(480);
  // Centred: equal space either side, within a pixel or two.
  expect(Math.abs(tabs!.x - (viewport.width - tabs!.x - tabs!.width))).toBeLessThan(40);
});

test.describe('not found', () => {
  // The browser logs the page's own 404 status as a console error.
  test.use({ allowConsoleErrors: [/status of 404/] });

  test('X11 an unknown address shows the app 404 page, which leads home', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await ready(page);
    await expect(page.getByRole('heading', { name: t('notFound.title'), level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${escape(t('notFound.title'))} \\| Shtëpia\\.ime$`));
    // Same exception as a11y.spec.ts: white on the solid orange button.
    expect(await axeViolations(page, { known: ['color-contrast'] })).toEqual([]);
    await page.getByRole('button', { name: t('common.home') }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('time of day', () => {
  test.use({ timezoneId: 'Europe/Tirane' });

  // The pages are pre-rendered at build time; a greeting chosen from the
  // build's clock broke hydration (React #418) for visitors at another hour.
  // The guard fails the test on that page error.
  for (const [when, key] of [['09:00', 'home.greetingMorning'], ['20:30', 'home.greetingEvening']] as const) {
    test(`X12 at ${when} the greeting follows the visitor's clock and the pages hydrate`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(`2026-10-21T${when}:00+02:00`));
      await page.goto('/');
      await ready(page);
      await expect(page.getByText(t(key)).first()).toBeVisible();
      await page.goto('/privacy');
      await ready(page);
      await expect(page.getByRole('heading', { name: t('legal.privacyPolicy'), level: 1 })).toBeVisible();
    });
  }
});

// Profile -> Notifications. The website cannot receive pushes, so this checks
// the account's two switches (saved server-side, shared by every device) and
// that the sheet never presents them as "notifications will arrive here".
async function preferencesBackend(page: Page, initial: { messages: boolean; viewings: boolean }, fail: { read?: number; write?: boolean } = {}) {
  const server = { ...initial };
  const saves: Record<string, unknown>[] = [];
  let failedReads = 0;
  await page.route('**/rest/v1/notification_preferences*', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      if (fail.read && failedReads < fail.read) {
        failedReads++;
        return json(route, { code: 'PGRST000', message: 'unavailable' }, 400);
      }
      const asObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(route, asObject ? server : [server]);
    }
    const body = req.postDataJSON() as { messages: boolean; viewings: boolean };
    saves.push(body);
    if (fail.write) return json(route, { code: '42501', message: 'denied' }, 400);
    Object.assign(server, body);
    return route.fulfill({ status: 201, headers: CORS, body: '' });
  });
  return { server, saves };
}

async function openNotifications(page: Page) {
  await page.getByRole('button', { name: t('notifications.title') }).click();
  await expect(page.getByRole('heading', { name: t('notifications.title') })).toBeVisible();
}

test.describe('notifications sheet', () => {
  test.use({ signedIn: true });

  test('X13 each switch saves only itself and the choice survives reopening and a reload', async ({ page }) => {
    const backend = await preferencesBackend(page, { messages: true, viewings: true });
    await page.goto('/profile');
    await ready(page);
    await openNotifications(page);
    await expect(page.getByText(t('notifications.web'))).toBeVisible();
    // Saved choices, clearly not "arriving on this device".
    await expect(page.getByText(t('notifications.prefsNote'))).toBeVisible();
    const messages = page.getByRole('switch', { name: t('notifications.messages') });
    const viewings = page.getByRole('switch', { name: t('notifications.viewings') });
    await expect(messages).toHaveAttribute('aria-checked', 'true');
    await messages.click();
    await expect(messages).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => backend.server).toEqual({ messages: false, viewings: true });
    expect(backend.saves).toEqual([{ messages: false, viewings: true }]);
    await expect(viewings).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: t('common.close') }).last().click();
    await openNotifications(page);
    await expect(page.getByRole('switch', { name: t('notifications.messages') })).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await ready(page);
    await openNotifications(page);
    await expect(page.getByRole('switch', { name: t('notifications.messages') })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: t('notifications.viewings') })).toHaveAttribute('aria-checked', 'true');
  });

  test('X14 rapid taps on both switches end with the newest choice saved', async ({ page }) => {
    const backend = await preferencesBackend(page, { messages: true, viewings: true });
    await page.goto('/profile');
    await ready(page);
    await openNotifications(page);
    const messages = page.getByRole('switch', { name: t('notifications.messages') });
    const viewings = page.getByRole('switch', { name: t('notifications.viewings') });
    await expect(messages).toHaveAttribute('aria-checked', 'true');
    await messages.click();
    await viewings.click();
    await messages.click();
    await expect.poll(() => backend.server).toEqual({ messages: true, viewings: false });
    await expect(messages).toHaveAttribute('aria-checked', 'true');
    await expect(viewings).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText(t('notifications.saving'))).toBeHidden();
  });

  test.describe('failures', () => {
    test.use({ allowConsoleErrors: [/status of 400/] });

    test('X15 a failed save puts the switch back and says so', async ({ page }) => {
      await preferencesBackend(page, { messages: true, viewings: true }, { write: true });
      await page.goto('/profile');
      await ready(page);
      await openNotifications(page);
      const messages = page.getByRole('switch', { name: t('notifications.messages') });
      await expect(messages).toHaveAttribute('aria-checked', 'true');
      await messages.click();
      await expect(page.getByText(t('notifications.saveFailed'))).toBeVisible();
      await expect(messages).toHaveAttribute('aria-checked', 'true');
    });

    test('X16 when the saved choices cannot be read, the switches wait instead of showing defaults', async ({ page }) => {
      const backend = await preferencesBackend(page, { messages: false, viewings: false }, { read: 1 });
      await page.goto('/profile');
      await ready(page);
      await openNotifications(page);
      await expect(page.getByText(t('notifications.loadFailed'))).toBeVisible();
      const messages = page.getByRole('switch', { name: t('notifications.messages') });
      await expect(messages).toBeDisabled();
      await messages.dispatchEvent('click');
      expect(backend.saves).toEqual([]);
      await page.getByRole('button', { name: t('common.retry') }).click();
      await expect(messages).toBeEnabled();
      await expect(messages).toHaveAttribute('aria-checked', 'false');
    });
  });
});

// Email code: one send per tap, and Supabase's "wait N seconds" drives the
// resend timer (the earlier code is still valid, so code entry opens).
test.describe('email code', () => {
  test.use({ allowConsoleErrors: [/status of 429/] });

  test('X17 a double tap sends one code', async ({ page }) => {
    const sent: unknown[] = [];
    await page.route('**/auth/v1/otp*', async (route) => {
      sent.push(route.request().postDataJSON());
      await new Promise((r) => setTimeout(r, 400));
      return json(route, {});
    });
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('textbox', { name: t('auth.email') }).fill('new.user@example.com');
    await page.getByRole('button', { name: t('auth.signInWithEmail') }).dblclick();
    await expect(page.getByText(t('auth.enterCode')).first()).toBeVisible();
    expect(sent).toHaveLength(1);
  });

  test('X18 "wait N seconds" opens code entry with the resend timer at the server\'s number', async ({ page }) => {
    await page.route('**/auth/v1/otp*', (route) =>
      json(route, { code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 42 seconds.' }, 429),
    );
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('textbox', { name: t('auth.email') }).fill('new.user@example.com');
    await page.getByRole('button', { name: t('auth.signInWithEmail') }).click();
    await expect(page.getByText(t('auth.enterCode')).first()).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(t('auth.resendIn').replace('{{s}}', '4[12]')) })).toBeDisabled();
  });
});

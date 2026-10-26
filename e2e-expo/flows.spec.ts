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

// Password recovery in the app. The emailed code signs you in (verifyOtp), and
// the signed-in dashboard used to replace the new-password step within a
// moment, so the new password was never set.
test('X27 forgot password: the code opens the new-password step, which stays until the password is saved', async ({ page }) => {
  const recovered: unknown[] = [];
  const saved: unknown[] = [];
  await page.route('**/auth/v1/recover*', (route) => json(route, {}));
  await page.route('**/auth/v1/verify*', (route) => {
    recovered.push(route.request().postDataJSON());
    return json(route, fakeSession());
  });
  await page.route('**/auth/v1/user*', (route) => {
    if (route.request().method() === 'PUT') saved.push(route.request().postDataJSON());
    return json(route, SIGNED_IN_USER);
  });
  await page.goto('/profile');
  await ready(page);
  await page.getByRole('textbox', { name: t('auth.email') }).fill('agent@example.com');
  await page.getByRole('button', { name: t('auth.forgotShort') }).click();
  // Its own step, with the address already typed.
  await expect(page.getByText(t('auth.forgotTitle'))).toBeVisible();
  await expect(page.getByRole('textbox', { name: t('auth.email') })).toHaveValue('agent@example.com');
  await page.getByRole('button', { name: t('auth.sendCode') }).click();
  await page.getByRole('textbox', { name: t('auth.codeDigit').replace('{{n}}', '1') }).fill('123456');

  const newPassword = page.getByPlaceholder(t('auth.newPassword'));
  await expect(newPassword).toBeVisible();
  // Signed in by now, and the profile has loaded: the step must still be here.
  await ready(page);
  await expect(newPassword).toBeVisible();
  expect(recovered[0]).toMatchObject({ email: 'agent@example.com', token: '123456', type: 'recovery' });

  await newPassword.fill('NewPassword!2026');
  await page.getByPlaceholder(t('auth.confirmPassword')).fill('NewPassword!2026');
  await page.getByRole('button', { name: t('auth.updatePassword') }).click();
  await expect(page.getByRole('heading', { name: t('common.profile'), level: 1 })).toBeVisible();
  expect(saved[0]).toMatchObject({ password: 'NewPassword!2026' });
});

// Signed out, screens that need an account ask for one. The listing form used
// to take all five steps and then fail with "Authentication failed"; the
// dashboard waited forever.
for (const path of ['/listing/new', '/agent-dashboard']) {
  test(`X28 signed out, ${path} asks you to sign in`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    await expect(page.getByText(t('addSheet.signInFirst'))).toBeVisible();
    await page.getByRole('button', { name: t('common.signIn') }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });
}

// Signed out, a heart looked saved but was never stored.
test('X29 signed out, a heart on a card goes to sign-in instead of pretending to save', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: t('common.save') }).first().click();
  await expect(page).toHaveURL(/\/profile$/);
});

// Layout boundaries on the narrowest supported phone (docs/UI_POLISH.md):
// no control may sit past the screen edge, and the header wordmark is either
// clear of the header's buttons or not shown at all.
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const W = window.innerWidth;
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      let n: Element | null = el;
      while (n) {
        if (Number(getComputedStyle(n).opacity) === 0) return false;
        n = n.parentElement;
      }
      return r.width > 0 && r.height > 0;
    };
    const controls = [...document.querySelectorAll('[role=button],[role=link],[role=switch]')].filter(shown);
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      // Horizontal rails scroll on purpose; only check controls not inside one.
      let scroller = false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) scroller = true;
      }
      if (!scroller && (r.left < -1 || r.right > W + 1)) {
        problems.push(`off screen: ${el.getAttribute('aria-label') || (el as HTMLElement).innerText} ${Math.round(r.left)}-${Math.round(r.right)}`);
      }
    }
    const brand = [...document.querySelectorAll('div,span')].find(
      (el) => el.childElementCount <= 1 && (el as HTMLElement).innerText === 'Shtëpia.ime' && shown(el) && el.getBoundingClientRect().top < 80,
    );
    if (brand) {
      const b = brand.getBoundingClientRect();
      for (const el of controls) {
        const r = el.getBoundingClientRect();
        if (r.top > 80) continue;
        if (Math.min(b.right, r.right) - Math.max(b.left, r.left) > 0 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 0) {
          problems.push(`wordmark overlaps ${el.getAttribute('aria-label')}`);
        }
      }
    }
    return problems;
  });
}

test.describe('narrow phone layout', () => {
  test.use({ viewport: { width: 320, height: 640 }, signedIn: true });

  for (const path of ['/', '/explore', '/profile', '/my-listings', '/viewings', '/agent-dashboard', '/saved-searches', `/property/${FEATURED.id}`]) {
    test(`X19 at 320px ${path} keeps every control on screen and the wordmark clear`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone project only');
      await page.goto(path);
      await ready(page);
      await page.waitForTimeout(500);
      expect(await layoutProblems(page)).toEqual([]);
    });
  }
});

// The listing wizard end to end in the app's web build: two photos, then
// publish or draft (docs/PHOTO_KEYBOARD_PRICE_REPORT.md). Storage and the
// properties table are answered here; what the app sends is recorded.
type StorageSent = { path: string; contentType: string; bytes: number; multipart: boolean };

async function wizardBackend(page: Page, opts: { failFirstUpload?: boolean; loseFirstInsert?: boolean } = {}) {
  const storage: StorageSent[] = [];
  const removed: string[] = [];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let uploadCalls = 0;
  let insertCalls = 0;
  // Picking a city centres the map via OpenStreetMap's geocoder.
  await page.route(/nominatim\.openstreetmap\.org|photon\.komoot\.io/, (route) =>
    json(route, [{ lat: '41.3275', lon: '19.8187', display_name: 'Tiranë' }]),
  );
  await page.route('**/storage/v1/object/**', async (route) => {
    const req = route.request();
    if (req.method() === 'DELETE' || (req.method() === 'POST' && req.url().endsWith('/storage/v1/object/property-images'))) {
      try { removed.push(...((req.postDataJSON() as { prefixes?: string[] })?.prefixes ?? [])); } catch { /* none */ }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' });
    }
    if (req.method() !== 'POST') return route.fallback();
    uploadCalls++;
    const contentType = req.headers()['content-type'] ?? '';
    const path = new URL(req.url()).pathname.replace('/storage/v1/object/property-images/', '');
    storage.push({ path, contentType, bytes: req.postDataBuffer()?.length ?? 0, multipart: contentType.startsWith('multipart/') });
    if (opts.failFirstUpload && uploadCalls === 1) {
      return route.fulfill({ status: 400, contentType: 'application/json', headers: CORS, body: JSON.stringify({ statusCode: '415', error: 'invalid_mime_type', message: 'mime type text/plain is not supported' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ Key: `property-images/${path}` }) });
  });
  await page.route('**/rest/v1/properties*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      insertCalls++;
      inserts.push(req.postDataJSON());
      if (opts.loseFirstInsert && insertCalls === 1) return route.abort('connectionreset');
      if (opts.loseFirstInsert && insertCalls === 2) {
        return route.fulfill({ status: 409, contentType: 'application/json', headers: CORS, body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "properties_pkey"' }) });
      }
      return route.fulfill({ status: 201, headers: CORS, body: '' });
    }
    if (req.method() === 'PATCH') {
      updates.push(req.postDataJSON());
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    }
    if (opts.loseFirstInsert && req.url().includes('id=eq.')) {
      // The row the lost first attempt wrote.
      const first = inserts[0] ?? {};
      return json(route, { image_urls: first.image_urls ?? [], video_url: null });
    }
    return route.fallback();
  });
  return { storage, removed, inserts, updates };
}

const PHOTOS = ['assets/images/icon-light.png', 'assets/images/icon-dark.png'];
// The footer button (the step dots also carry the step's name).
const publishButton = (page: Page) => page.getByRole('button', { name: t('listing.publish') }).last();

async function toPriceStep(page: Page) {
  await page.goto('/listing/new');
  await ready(page);
  await page.getByPlaceholder(t('listing.titlePlaceholder')).fill('Apartament prove 2+1');
  await page.getByPlaceholder(t('listing.descriptionPlaceholder')).fill('Rreshti i parë\nRreshti i dytë');
  await page.getByRole('button', { name: t('listing.next') }).click();
  await page.getByRole('button', { name: t('listing.city') }).click();
  await page.getByRole('button', { name: 'Tiranë', exact: true }).click();
  await page.getByRole('button', { name: t('listing.next') }).click();
}

async function fillWizard(page: Page) {
  await toPriceStep(page);
  const price = page.getByRole('textbox', { name: t('listing.price') });
  await price.fill('1.200.000');
  await expect(price).toHaveValue('1200000');
  await page.getByPlaceholder('0').nth(1).fill('85');
  await page.getByRole('button', { name: t('listing.next') }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: t('listing.dropImages') }).click();
  await (await chooser).setFiles(PHOTOS);
  // The first photo is marked as the cover once both are in.
  await expect(page.getByText(t('listing.cover'))).toBeVisible();
  await page.getByRole('button', { name: t('listing.next') }).click();
  await page.getByPlaceholder('+355 69...').fill('+355 69 000 0000');
}

test.describe('listing wizard', () => {
  test.use({ signedIn: true, allowConsoleErrors: [/status of 4\d\d|ERR_CONNECTION_RESET|Failed to fetch|fetch failed/i] });

  test('X20 publish with two photos: bytes reach storage as JPEG, one row with both photos in order', async ({ page }) => {
    const backend = await wizardBackend(page);
    await fillWizard(page);
    await publishButton(page).click();
    await expect(page).toHaveURL(/\/my-listings$/);
    expect(backend.storage).toHaveLength(2);
    for (const s of backend.storage) {
      expect(s.contentType).toBe('image/jpeg');
      expect(s.multipart).toBe(false);
      expect(s.bytes).toBeGreaterThan(100);
    }
    expect(backend.inserts).toHaveLength(1);
    const row = backend.inserts[0] as { id: string; status: string; price: number; currency: string; image_urls: string[] };
    expect(row.status).toBe('active');
    expect(row.price).toBe(1200000);
    expect(row.currency).toBe('EUR');
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.image_urls).toHaveLength(2);
    backend.storage.forEach((s, i) => expect(row.image_urls[i]).toContain(s.path));
  });

  test('X21 save as draft stores a draft', async ({ page }) => {
    const backend = await wizardBackend(page);
    await fillWizard(page);
    await page.getByRole('button', { name: t('listing.saveDraft') }).click();
    await expect(page).toHaveURL(/\/my-listings$/);
    expect(backend.inserts).toHaveLength(1);
    expect((backend.inserts[0] as { status: string }).status).toBe('draft');
  });

  test('X22 a refused photo: a translated message, the form kept, and a retry saves one listing', async ({ page }) => {
    const backend = await wizardBackend(page, { failFirstUpload: true });
    await fillWizard(page);
    await publishButton(page).click();
    await expect(page.getByText(t('errors.imageUploadFailed'))).toBeVisible();
    await expect(page.getByText(/Exception|renderAsync|text\/plain/)).toHaveCount(0);
    expect(backend.inserts).toHaveLength(0);
    // Still on the last step with the phone number typed.
    await expect(page.getByPlaceholder('+355 69...')).toHaveValue('+355 69 000 0000');
    await publishButton(page).click();
    await expect(page).toHaveURL(/\/my-listings$/);
    expect(backend.inserts).toHaveLength(1);
    expect((backend.inserts[0] as { image_urls: string[] }).image_urls).toHaveLength(2);
  });

  test('X23 a lost reply then a retry: the same id, an update instead of a second listing', async ({ page }) => {
    const backend = await wizardBackend(page, { loseFirstInsert: true });
    await fillWizard(page);
    await publishButton(page).click();
    await expect(page.getByText(t('errors.listingSaveFailed'))).toBeVisible();
    // Unknown outcome: the first attempt's photos are kept, not deleted.
    expect(backend.removed).toEqual([]);
    await publishButton(page).click();
    await expect(page).toHaveURL(/\/my-listings$/);
    expect(backend.inserts).toHaveLength(2);
    const [first, second] = backend.inserts as { id: string }[];
    expect(second.id).toBe(first.id);
    expect(backend.updates).toHaveLength(1);
    expect((backend.updates[0] as { status: string }).status).toBe('active');
  });
});

// The price row: the price field and the currency selector are one control
// size, top and bottom aligned (docs/PHOTO_KEYBOARD_PRICE_REPORT.md records
// the numbers this prints).
test.describe('price row', () => {
  test.use({ signedIn: true, allowConsoleErrors: [/status of 4\d\d/i] });

  for (const width of [320, 390]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`X24 at ${width}px, ${scheme}: price and currency share height and edges`, async ({ page, isMobile }, info) => {
        test.skip(!isMobile, 'phone project only');
        await page.setViewportSize({ width, height: 760 });
        await page.emulateMedia({ colorScheme: scheme });
        await wizardBackend(page);
        await toPriceStep(page);
        const input = page.getByRole('textbox', { name: t('listing.price') });
        const currency = page.getByRole('button', { name: t('listing.currency') });
        await expect(currency).toBeVisible();
        const m = await input.evaluate((el, label) => {
          // The bordered box around the input is the field itself.
          let field = el as HTMLElement;
          while (field.parentElement && parseFloat(getComputedStyle(field).borderTopWidth) === 0) field = field.parentElement;
          const select = document.querySelector(`[aria-label="${label}"]`) as HTMLElement;
          const icon = field.firstElementChild as HTMLElement;
          const r = (e: Element) => e.getBoundingClientRect();
          const f = r(field), c = r(select), i = r(icon), x = r(el);
          return {
            fieldHeight: f.height, currencyHeight: c.height,
            topDelta: Math.abs(f.top - c.top), bottomDelta: Math.abs(f.bottom - c.bottom),
            rowGap: c.left - f.right, currencyWidth: c.width,
            paddingLeft: i.left - f.left, iconSize: i.width, iconToText: x.left - i.right,
            iconCentreOffset: Math.abs((i.top + i.bottom) / 2 - (f.top + f.bottom) / 2),
            fieldRadius: getComputedStyle(field).borderTopLeftRadius, currencyRadius: getComputedStyle(select).borderTopLeftRadius,
            leftGutter: f.left, rightGutter: window.innerWidth - c.right,
          };
        }, t('listing.currency'));
        await info.attach('price-row.json', { body: JSON.stringify(m, null, 2), contentType: 'application/json' });
        console.info(`price-row ${width} ${scheme} ${JSON.stringify(m)}`);
        await page.locator('body').screenshot({ path: info.outputPath(`price-row-${width}-${scheme}.png`) });
        expect(Math.abs(m.fieldHeight - m.currencyHeight)).toBeLessThanOrEqual(0.5);
        // Sub-pixel layout can report 53.99998; same 0.5 tolerance as the checks around it.
        expect(m.fieldHeight).toBeGreaterThanOrEqual(53.5);
        expect(m.topDelta).toBeLessThanOrEqual(0.5);
        expect(m.bottomDelta).toBeLessThanOrEqual(0.5);
        expect(m.iconCentreOffset).toBeLessThanOrEqual(1);
        expect(m.fieldRadius).toBe(m.currencyRadius);
        expect(Math.abs(m.leftGutter - m.rightGutter)).toBeLessThanOrEqual(0.5);
      });
    }
  }
});

// Profile photo: pick, resize to JPEG, upload the bytes, point the profile at
// it, and only then remove the old one. A refused profile update keeps the
// old photo and removes the new file.
test.describe('profile photo', () => {
  test.use({ signedIn: true, allowConsoleErrors: [/status of 4\d\d|ERR_FAILED/i] });

  const OLD = `https://e2e.supabase.co/storage/v1/object/public/avatars/${SIGNED_IN_USER.id}/avatar-1.jpg`;

  async function avatarBackend(page: Page, opts: { refuseUpdate?: boolean } = {}) {
    const uploads: StorageSent[] = [];
    const removed: string[] = [];
    const updates: Record<string, unknown>[] = [];
    await page.route('**/storage/v1/object/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === 'DELETE' || (req.method() === 'POST' && url.pathname.endsWith('/storage/v1/object/avatars'))) {
        try { removed.push(...((req.postDataJSON() as { prefixes?: string[] })?.prefixes ?? [])); } catch { /* none */ }
        return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' });
      }
      if (req.method() !== 'POST') return route.fallback();
      const contentType = req.headers()['content-type'] ?? '';
      const path = url.pathname.replace('/storage/v1/object/avatars/', '');
      uploads.push({ path, contentType, bytes: req.postDataBuffer()?.length ?? 0, multipart: contentType.startsWith('multipart/') });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ Key: `avatars/${path}` }) });
    });
    await page.route('**/rest/v1/profiles*', async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        updates.push(req.postDataJSON());
        if (opts.refuseUpdate) {
          return route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }) });
        }
        return route.fulfill({ status: 204, headers: CORS, body: '' });
      }
      const row = { ...LISTINGS[0].agent, id: SIGNED_IN_USER.id, role: 'agent', avatar_url: OLD };
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(route, single ? row : [row]);
    });
    return { uploads, removed, updates };
  }

  async function changePhoto(page: Page) {
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('button', { name: t('profile.edit.title') }).first().click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: t('profile.edit.changePhoto') }).click();
    await (await chooser).setFiles(PHOTOS[0]);
  }

  test('X25 replacing the photo uploads a JPEG, updates the profile, then removes the old file', async ({ page }) => {
    const backend = await avatarBackend(page);
    await changePhoto(page);
    await expect.poll(() => backend.removed.length).toBe(1);
    expect(backend.uploads).toHaveLength(1);
    const [up] = backend.uploads;
    expect(up.path).toMatch(new RegExp(`^${SIGNED_IN_USER.id}/avatar-\\d+\\.jpg$`));
    expect(up.contentType).toBe('image/jpeg');
    expect(up.multipart).toBe(false);
    expect(up.bytes).toBeGreaterThan(100);
    expect(backend.updates).toEqual([{ avatar_url: expect.stringContaining(up.path) }]);
    expect(backend.removed).toEqual([`${SIGNED_IN_USER.id}/avatar-1.jpg`]);
    await expect(page.getByText(t('profile.edit.photoFailed'))).toHaveCount(0);
  });

  test('X26 a refused profile update: a translated message, the old photo kept, the new file removed', async ({ page }) => {
    const backend = await avatarBackend(page, { refuseUpdate: true });
    await changePhoto(page);
    await expect(page.getByText(t('profile.edit.photoFailed'))).toBeVisible();
    expect(backend.uploads).toHaveLength(1);
    expect(backend.removed).toEqual([backend.uploads[0].path]);
    expect(backend.removed).not.toContain(`${SIGNED_IN_USER.id}/avatar-1.jpg`);
  });
});

// Pass 20: change the password while signed in, in the app.
test.describe('signed in: Password & security', () => {
  test.use({ signedIn: true });
  const CURRENT = 'the-current-one';

  test('X30 the current password is checked first, then the new one is set and other devices signed out', async ({ page }) => {
    const checks: Record<string, unknown>[] = [];
    const saved: unknown[] = [];
    const logouts: string[] = [];
    await page.route('**/auth/v1/token*', (route) => {
      const body = route.request().postDataJSON();
      checks.push(body);
      return body.password === CURRENT
        ? json(route, fakeSession())
        : json(route, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
    });
    await page.route('**/auth/v1/user*', (route) => {
      if (route.request().method() === 'PUT') saved.push(route.request().postDataJSON());
      return json(route, SIGNED_IN_USER);
    });
    await page.route('**/auth/v1/logout*', (route) => {
      logouts.push(route.request().url());
      return json(route, {});
    });
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('button', { name: t('security.row') }).click();
    await expect(page.getByText(t('security.title')).first()).toBeVisible();

    await page.getByLabel(t('security.currentPassword')).fill('not-it-at-all');
    await page.getByLabel(t('auth.newPassword')).fill('a-brand-new-password');
    await page.getByLabel(t('auth.confirmPassword')).fill('a-brand-new-password');
    await page.getByRole('button', { name: t('security.save') }).click();
    await expect(page.getByText(t('errors.currentPasswordWrong'))).toBeVisible();
    expect(saved).toEqual([]);

    await page.getByLabel(t('security.currentPassword')).fill(CURRENT);
    await page.getByRole('button', { name: t('security.save') }).click();
    await expect(page.getByText(t('security.success'))).toBeVisible();
    await expect(page.getByText(t('security.othersSignedOut'))).toBeVisible();
    expect(checks.at(-1)).toMatchObject({ email: SIGNED_IN_USER.email, password: CURRENT });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ password: 'a-brand-new-password' });
    expect(logouts.some((u) => u.includes('scope=others'))).toBe(true);
  });

  test('X31 a short or mismatched new password never reaches Supabase', async ({ page }) => {
    const calls: string[] = [];
    await page.route('**/auth/v1/token*', (route) => { calls.push('token'); return json(route, fakeSession()); });
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('button', { name: t('security.row') }).click();
    await page.getByLabel(t('security.currentPassword')).fill(CURRENT);
    await page.getByLabel(t('auth.newPassword')).fill('short');
    await page.getByLabel(t('auth.confirmPassword')).fill('short');
    await page.getByRole('button', { name: t('security.save') }).click();
    await expect(page.getByText(t('errors.passwordMin')).last()).toBeVisible();
    await page.getByLabel(t('auth.newPassword')).fill('long-enough-one');
    await page.getByLabel(t('auth.confirmPassword')).fill('long-enough-two');
    await page.getByRole('button', { name: t('security.save') }).click();
    await expect(page.getByText(t('errors.passwordMismatch'))).toBeVisible();
    expect(calls).toEqual([]);
  });
});

test('X32 signing in before confirming the email opens the code entry instead of a dead end', async ({ page }) => {
  await page.route('**/auth/v1/token*', (route) => json(route, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400));
  await page.goto('/profile');
  await ready(page);
  await page.getByRole('textbox', { name: t('auth.email') }).fill('new.user@example.com');
  await page.getByLabel(t('auth.password'), { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: t('auth.stepInside') }).click();
  await expect(page.getByText(t('auth.enterCode')).first()).toBeVisible();
  await expect(page.getByText(t('auth.signupCodeHint'))).toBeVisible();
});

// Pass 20, account tools in the app: a failed read is not an empty list.
for (const [path, table] of [['/viewings', 'viewings'], ['/my-listings', 'properties'], ['/saved-searches', 'saved_searches']] as const) {
  test.describe(`signed in, app ${path}`, () => {
    test.use({ signedIn: true, allowConsoleErrors: [/status of 400/] });

    test(`X33 ${path}: a failed load offers a retry, which loads`, async ({ page }) => {
      let fail = true;
      await page.route(`**/rest/v1/${table}*`, (route) => {
        const owned = table !== 'properties' || route.request().url().includes('owner_id');
        if (route.request().method() !== 'GET' || !fail || !owned) return route.fallback();
        return json(route, { code: '57014', message: 'canceling statement due to statement timeout' }, 400);
      });
      await page.goto(path);
      await ready(page);
      await expect(page.getByText(t('errors.loadFailed'))).toBeVisible();
      fail = false;
      await page.getByRole('button', { name: t('common.retry') }).click();
      await expect(page.getByText(t('errors.loadFailed'))).toHaveCount(0);
    });
  });
}

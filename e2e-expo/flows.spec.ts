import type { Page, Route } from '@playwright/test';

import { AGENT, CHAT_CLIENT_ID, CONVERSATIONS, LISTINGS, PERFORMANCE_REPORT } from '../e2e/support/fixtures';
import { fakeSession, SESSION_STORAGE_KEY, SIGNED_IN_USER } from '../e2e/support/backend';
import { AI_CHAT_ENABLED } from '../constants/features';
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
    for (const label of [t('profile.edit.title'), t('notifications.settings'), t('listing.myListings')]) {
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
    await expect(page).toHaveURL(new RegExp(`/messages/${CONVERSATIONS[0].id}(\\?.*)?$`));
    await expect(page.getByRole('heading', { name: 'Ana Klientja', level: 1 })).toBeVisible();
    await page.getByRole('textbox', { name: t('messages.inputPlaceholder') }).fill('Përshëndetje, a është ende në shitje?');
    await page.getByRole('button', { name: t('common.send') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'messages')?.method).toBe('POST');
    expect(writes.find((w) => w.table === 'messages')?.body).toMatchObject({
      conversation_id: CONVERSATIONS[0].id,
      body: 'Përshëndetje, a është ende në shitje?',
    });
  });

  // Messages is a real tab: the menu stays, nothing jumps back by itself,
  // and the person picks where to go next.
  for (const trip of [
    { from: '/', next: () => t('common.search'), nextUrl: /\/explore$/ },
    { from: '/explore', next: () => t('common.profile'), nextUrl: /\/profile$/ },
    { from: '/profile', next: () => t('common.home'), nextUrl: /\/$/ },
  ]) {
    test(`X72 from ${trip.from}: Messages keeps the menu, a chat returns to the inbox, and the next tab is the person's choice`, async ({ page }) => {
      await page.route(`**/rest/v1/profiles*id=eq.${CHAT_CLIENT_ID}*`, (route) =>
        json(route, { full_name: 'Ana Klientja', agency_name: null }),
      );
      const tab = (name: string) => page.getByRole('tab', { name, exact: true });
      await page.goto(trip.from);
      await ready(page);

      await tab(t('common.messages')).click();
      await expect(page).toHaveURL(/\/messages$/);
      await expect(tab(trip.next())).toBeVisible();
      await expect(page.getByRole('button', { name: t('common.back'), exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: new RegExp(escape(LISTINGS[0].title as string)) }).click();
      await expect(page).toHaveURL(new RegExp(`/messages/${CONVERSATIONS[0].id}$`));
      await expect(page.getByRole('heading', { name: 'Ana Klientja', level: 1 })).toBeVisible();
      await page.getByRole('button', { name: t('common.back') }).last().click();

      // Leaving the chat stays in Messages, and it stays there.
      await expect(page).toHaveURL(/\/messages$/);
      await page.waitForTimeout(400);
      await expect(page).toHaveURL(/\/messages$/);

      await tab(trip.next()).click();
      await expect(page).toHaveURL(trip.nextUrl);
      await expect(tab(t('common.messages'))).toBeVisible();
    });
  }

  test('X73 the Profile menu and the agent dashboard both open the Messages tab, with the menu', async ({ page }) => {
    const tab = (name: string) => page.getByRole('tab', { name, exact: true });
    await page.goto('/profile');
    await ready(page);
    await page.getByRole('button', { name: new RegExp(t('common.messages')) }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(tab(t('common.home'))).toBeVisible();

    await page.goto('/agent-dashboard');
    await ready(page);
    await page.getByRole('button', { name: new RegExp(t('agentDashboard.statConversations')) }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(tab(t('common.home'))).toBeVisible();
  });

  test('X42 viewing request: the website has a date and time field, and the chosen time is sent', async ({ page, writes }) => {
    const home = LISTINGS.find((l) => l.owner_type === 'client')!;
    await page.goto(`/property/${home.id}`);
    await ready(page);
    await page.getByRole('button', { name: t('detail.scheduleViewing') }).click();
    const when = page.getByLabel(t('viewings.when'));
    await expect(when).toBeVisible();
    const day = new Date(Date.now() + 3 * 86_400_000);
    day.setHours(15, 30, 0, 0);
    const p = (n: number) => String(n).padStart(2, '0');
    await when.fill(`${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}T15:30`);
    await page.getByRole('button', { name: t('viewings.request') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'viewings')?.method).toBe('POST');
    expect(writes.find((w) => w.table === 'viewings')?.body).toMatchObject({
      property_id: home.id,
      scheduled_at: day.toISOString(),
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

test('X64 Russian headlines switch to Manrope at once, and back to Newsreader in Albanian', async ({ page }) => {
  // Newsreader has no Cyrillic: Russian headlines fell back to each phone's
  // system font. Counts the elements drawn in each family, without a reload.
  const families = () =>
    page.evaluate(() => {
      const count = { newsreader: 0, manrope: 0, cyrillicInNewsreader: 0 };
      for (const el of Array.from(document.querySelectorAll('div, span'))) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
        const f = getComputedStyle(el).fontFamily;
        if (/Newsreader/.test(f)) {
          count.newsreader++;
          if (/[Ѐ-ӿ]/.test(el.textContent!)) count.cyrillicInNewsreader++;
        } else if (/Manrope/.test(f)) count.manrope++;
      }
      return count;
    });
  // The menu button's own label is in the current language.
  const pickLanguage = async (menuLabel: string, name: RegExp) => {
    await page.getByRole('button', { name: menuLabel, exact: true }).click();
    await page.getByRole('button', { name }).click();
  };
  await page.goto('/');
  await ready(page);
  expect((await families()).newsreader).toBeGreaterThan(0);

  await pickLanguage(t('common.language'), /Русский/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect.poll(async () => (await families()).newsreader).toBe(0);
  expect((await families()).cyrillicInNewsreader).toBe(0);

  await pickLanguage('Язык', /Shqip/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'sq');
  await expect.poll(async () => (await families()).newsreader).toBeGreaterThan(0);
});

test('X76 the bottom menu says what each button is, and sign-up is in view without scrolling', async ({ page }) => {
  await page.goto('/profile');
  await ready(page);
  const menu = page.getByRole('tablist');
  for (const word of [t('common.home'), t('common.search'), t('common.messages'), t('common.profile')]) {
    await expect(menu.getByText(word, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(t('common.addShort'), { exact: true })).toBeVisible();
  // Above the other sign-in options, so a new person does not have to scroll.
  const join = await page.getByText(t('common.signUp'), { exact: true }).first().boundingBox();
  const others = await page.getByText(t('auth.signInWith'), { exact: true }).boundingBox();
  expect(join!.y).toBeLessThan(others!.y);
});

test.describe('Published by', () => {
  const publisher = (page: Page, row: object) =>
    page.route('**/rest/v1/rpc/listing_publisher*', (route) => json(route, [row]));
  const open = async (page: Page, id: string) => {
    await page.goto(`/property/${id}`);
    await ready(page);
    await expect(page.getByRole('heading', { name: t('detail.publishedBy') })).toBeVisible();
  };

  test('X78 an agent shows name, office and a phone that calls', async ({ page }) => {
    await publisher(page, { kind: 'agent', full_name: 'Arta Hoxha', phone: '+355691112222', agency_name: 'Future Home Orange' });
    await open(page, FEATURED.id);
    await expect(page.getByText('Arta Hoxha', { exact: true })).toBeVisible();
    await expect(page.getByText('Future Home Orange', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `${t('property.call')}, +355691112222` })).toBeVisible();
  });

  test('X79 a client shows name and phone and no office, even if one comes back', async ({ page }) => {
    await publisher(page, { kind: 'client', full_name: 'Besnik Leka', phone: '+355693334444', agency_name: 'Should Not Show' });
    await open(page, LISTINGS.find((l) => !l.agent)!.id);
    await expect(page.getByText('Besnik Leka', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `${t('property.call')}, +355693334444` })).toBeVisible();
    await expect(page.getByText('Should Not Show')).toHaveCount(0);
  });

  test('X80 a client with no name on file reads as the owner, with no blanks', async ({ page }) => {
    await publisher(page, { kind: 'client', full_name: null, phone: '+355693334444', agency_name: null });
    await open(page, LISTINGS.find((l) => !l.agent)!.id);
    await expect(page.getByText(t('detail.owner'), { exact: true }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('undefined');
  });
});

test.describe('headline typewriter', () => {
  const first = `${t('home.heroPhrases.0.lead')} ${t('home.heroPhrases.0.accent')}`;
  const second = t('home.heroPhrases.1.lead');

  test.describe('with motion', () => {
    test.use({ contextOptions: { reducedMotion: 'no-preference' } });

    test('X85 types the next phrase, never moves the search bar, and follows the language', async ({ page }) => {
      await page.goto('/');
      await ready(page);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toContainText(first.slice(0, 12));
      const search = page.getByText(t('home.searchPlaceholder')).first();
      const startY = (await search.boundingBox())!.y;
      const ys = new Set<number>([Math.round(startY)]);
      await expect
        .poll(async () => {
          ys.add(Math.round((await search.boundingBox())!.y));
          return (await heading.textContent()) ?? '';
        }, { timeout: 15_000, intervals: [120] })
        .toContain(second);
      expect([...ys]).toEqual([Math.round(startY)]);
      // A cursor while animating, in the same run of text.
      await expect(heading).toContainText('|');

      await page.getByRole('button', { name: t('common.language') }).click();
      await page.getByRole('button', { name: /Русский/ }).click();
      await expect
        .poll(async () => /[\u0400-\u04FF]/.test((await heading.textContent()) ?? ''), { timeout: 15_000, intervals: [150] })
        .toBe(true);
    });
  });

  test('X86 with reduced motion it is one still phrase and no cursor', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(first);
    await page.waitForTimeout(3500);
    await expect(heading).toHaveText(first);
  });
});

test.describe('notification centre', () => {
  test.use({ signedIn: true, allowConsoleErrors: [/status of 403/] });
  const now = () => new Date().toISOString();
  const CONV = CONVERSATIONS[0].id;
  const rows = () => [
    { id: 'a0000000-0000-4000-8000-000000000001', kind: 'message', data: { conversation_id: CONV, sender_name: 'Arta' }, read_at: null, created_at: now() },
    { id: 'a0000000-0000-4000-8000-000000000002', kind: 'welcome', data: {}, read_at: now(), created_at: now() },
  ];
  const seed = (page: Page, writes: { table: string; method: string; query: string }[] | null = null, unread = 1) =>
    page.route('**/rest/v1/notifications*', (route) => {
      const req = route.request();
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${unread}`, 'access-control-expose-headers': 'content-range' } });
      if (req.method() === 'PATCH') {
        writes?.push({ table: 'notifications', method: 'PATCH', query: new URL(req.url()).search });
        return route.fulfill({ status: 204, headers: CORS, body: '' });
      }
      return json(route, rows());
    });

  test('X81 the bell shows the unread count and opens the centre', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: `${t('notifications.title')}, 1` }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByText(t('notifications.kinds.message.title'), { exact: true })).toBeVisible();
    await expect(page.getByText(t('notifications.unreadTag'), { exact: true })).toBeVisible();
  });

  test('X82 mark one, mark all, and a tap opens the conversation', async ({ page }) => {
    const writes: { table: string; method: string; query: string }[] = [];
    await seed(page, writes, 2);
    await page.goto('/notifications');
    await ready(page);
    await page.getByRole('button', { name: new RegExp(`^${t('notifications.markRead')}`) }).click();
    await expect.poll(() => writes.filter((w) => /id=eq\.a0000000/.test(w.query)).length).toBe(1);
    await page.getByRole('button', { name: t('notifications.markAll') }).click();
    await expect.poll(() => writes.filter((w) => !/[?&]id=eq/.test(w.query)).length).toBe(1);
    await page.getByRole('button', { name: new RegExp(t('notifications.kinds.message.title')) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/messages/${CONV}`));
  });

  test('X83 an empty centre says so and a failed load offers a retry', async ({ page }) => {
    let fail = true;
    await page.route('**/rest/v1/notifications*', (route) => {
      if (route.request().method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': '*/0', 'access-control-expose-headers': 'content-range' } });
      if (fail) return route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ code: '42501', message: 'no' }) });
      return json(route, []);
    });
    await page.goto('/notifications');
    await ready(page);
    await expect(page.getByText(t('notifications.loadFailed'))).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: t('common.retry') }).click();
    await expect(page.getByText(t('notifications.empty'), { exact: true })).toBeVisible();
  });

  test('X84 something arriving live drops a banner, and tapping it opens the conversation', async ({ page }) => {
    await seed(page, null, 0);
    let socket: { send: (m: string) => void } | null = null;
    let topic = '';
    let arrayFormat = false;
    await page.routeWebSocket(/supabase\.co/, (ws) => {
      ws.onMessage((raw) => {
        const text = String(raw);
        const isArray = text.startsWith('[');
        arrayFormat = isArray;
        const m = isArray ? (() => { const [join_ref, ref, t2, event, payload] = JSON.parse(text); return { join_ref, ref, topic: t2, event, payload }; })() : JSON.parse(text);
        const reply = (response: object) => {
          const payload = { status: 'ok', response };
          ws.send(isArray ? JSON.stringify([m.join_ref, m.ref, m.topic, 'phx_reply', payload]) : JSON.stringify({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload }));
        };
        if (m.event === 'phx_join') {
          const pc = m.payload?.config?.postgres_changes ?? [];
          reply({ postgres_changes: pc.map((c: object, i: number) => ({ ...c, id: i + 1 })) });
          if (String(m.topic).includes('notifications-')) {
            topic = m.topic;
            socket = { send: (out: string) => ws.send(out) };
          }
        } else if (m.event === 'heartbeat') reply({});
      });
    });
    await page.goto('/');
    await ready(page);
    await expect.poll(() => topic).not.toBe('');
    const payload = { ids: [1], data: { schema: 'public', table: 'notifications', commit_timestamp: now(), type: 'INSERT', columns: [
      { name: 'id', type: 'uuid' }, { name: 'kind', type: 'text' }, { name: 'data', type: 'jsonb' }, { name: 'read_at', type: 'timestamptz' }, { name: 'created_at', type: 'timestamptz' },
    ], record: { id: 'a0000000-0000-4000-8000-000000000009', kind: 'message', data: { conversation_id: CONV, sender_name: 'Arta' }, read_at: null, created_at: now() }, errors: null } };
    socket!.send(arrayFormat ? JSON.stringify([null, null, topic, 'postgres_changes', payload]) : JSON.stringify({ topic, event: 'postgres_changes', ref: null, payload }));
    const title = t('notifications.kinds.message.title');
    const banner = page.getByRole('button', { name: new RegExp(title) }).first();
    await expect(banner).toBeVisible();
    await banner.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${CONV}`));
  });
});

test('X77 price per m² shows on a home for sale and not on a rental', async ({ page }) => {
  const perSqm = page.getByText(/≈.*\/m²/);
  await page.goto(`/property/${LISTINGS.find((l) => l.listing_type === 'sale')!.id}`);
  await ready(page);
  await expect(perSqm).toBeVisible();

  await page.goto(`/property/${LISTINGS.find((l) => l.listing_type === 'rent')!.id}`);
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Garsoniere me qera' }).first()).toBeVisible();
  await expect(perSqm).toHaveCount(0);
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

  // The pages are pre-rendered at build time; Home used to greet by the
  // build's clock, which broke hydration (React #418) for visitors at another
  // hour. It now shows one fixed brand headline: the same at every hour, no
  // greeting, and the guard still fails the test on a hydration page error.
  for (const when of ['09:00', '20:30']) {
    test(`X12 at ${when} Home shows the brand headline, no greeting, and the pages hydrate`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(`2026-10-21T${when}:00+02:00`));
      await page.goto('/');
      await ready(page);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText(`${t('home.heroPhrases.0.lead')} ${t('home.heroPhrases.0.accent')}`);
      for (const key of ['home.greetingMorning', 'home.greetingAfternoon', 'home.greetingEvening']) {
        await expect(page.getByText(t(key))).toHaveCount(0);
      }
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
  await page.getByRole('button', { name: t('notifications.settings') }).click();
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

  for (const path of ['/', '/explore', '/profile', '/my-listings', '/viewings', '/agent-dashboard', '/performance', '/saved-searches', `/property/${FEATURED.id}`, '/assistant']) {
    test(`X19 at 320px ${path} keeps every control on screen and the wordmark clear`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone project only');
      await page.goto(path);
      await ready(page);
      await page.waitForTimeout(500);
      expect(await layoutProblems(page)).toEqual([]);
    });
  }
});

// A Galaxy Fold's cover screen is 280 wide, narrower than any phone. The
// Rent pill on Explore and the wizard's fifth step dot used to run off it.
test.describe('foldable cover screen', () => {
  test.use({ viewport: { width: 280, height: 653 }, signedIn: true });

  for (const path of ['/', '/explore', '/listing/new', '/profile', '/performance', `/property/${FEATURED.id}`, '/assistant']) {
    test(`X34 at 280px ${path} keeps every control on screen`, async ({ page, isMobile }) => {
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
  await expect(page.getByRole('heading', { name: t('auth.verifyEmailTitle') })).toBeVisible();
  await expect(page.getByText(t('auth.confirmFirst'))).toBeVisible();
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

test('X35 All/Sale/Rent: the tab lights up at once and its homes are already loaded', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/properties')) asked.push(decodeURIComponent(r.url()));
  });
  await page.goto('/explore');
  await ready(page);
  // The other two tabs were fetched in the background, before any tap.
  // Polled: under parallel load the prefetch can land after networkidle
  // (7 of 8 failed with --repeat-each=4 --workers=4, on master too).
  // Each tab is two requests (its first page and its count); wait for all
  // four, then for them to finish, before counting what a tap asks for.
  const sent = (type: string) => asked.filter((u) => u.includes(`listing_type=eq.${type}`)).length;
  await expect.poll(() => sent('rent')).toBeGreaterThanOrEqual(2);
  await expect.poll(() => sent('sale')).toBeGreaterThanOrEqual(2);
  await page.waitForLoadState('networkidle');

  const before = asked.length;
  const rent = page.getByRole('button', { name: t('search.rent'), exact: true });
  const all = page.getByRole('button', { name: t('common.all'), exact: true });
  const background = (el: typeof rent) => el.evaluate((n) => getComputedStyle(n).backgroundColor);
  const activeBg = await background(all);
  await rent.click();
  // Highlighted from the tap itself, not after the 350 ms typing debounce.
  // Sampled every 20 ms: the default intervals (100, 250…) look only twice in 200.
  await expect.poll(() => background(rent), { timeout: 200, intervals: [20] }).toBe(activeBg);
  const rentals = LISTINGS.filter((l) => l.listing_type === 'rent').length;
  await expect(page.getByText(/në shikim/)).toContainText(String(rentals), { timeout: 300 });
  // Shown from the prefetched cache: tapping asked the server for nothing new.
  expect(asked.slice(before).filter((u) => u.includes('listing_type=eq.rent'))).toEqual([]);
});

// The brand headline wraps inside the screen at every width and in both
// themes, with only its accent ending in orange. Signed in, so a name from the
// account would show here if the old personal greeting came back.
test.describe('brand headline', () => {
  test.use({ signedIn: true });

  for (const width of [280, 320, 390, 480]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`X65 at ${width}px, ${scheme}: the headline wraps on screen with an orange ending`, async ({ page, isMobile }, info) => {
        test.skip(!isMobile, 'phone project only');
        await page.setViewportSize({ width, height: 760 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('/');
        await ready(page);
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toHaveText(`${t('home.heroPhrases.0.lead')} ${t('home.heroPhrases.0.accent')}`);
        await expect(heading).not.toContainText(SIGNED_IN_USER.user_metadata.full_name.split(' ')[0]);
        const m = await heading.evaluate((el, accent) => {
          const span = Array.from(el.querySelectorAll('span')).find((s) => s.textContent?.trim() === accent) as HTMLElement;
          const r = el.getBoundingClientRect();
          const rgb = (c: string) => c.match(/\d+/g)!.slice(0, 3).map(Number);
          return {
            left: r.left, right: r.right, viewport: window.innerWidth,
            pageScrolls: document.documentElement.scrollWidth > window.innerWidth,
            overflows: el.scrollWidth > el.clientWidth,
            lines: Math.round(r.height / parseFloat(getComputedStyle(el).lineHeight)),
            accentRight: span ? Math.max(...Array.from(span.getClientRects()).map((x) => x.right)) : null,
            headlineColor: rgb(getComputedStyle(el).color),
            accentColor: span ? rgb(getComputedStyle(span).color) : null,
            accentFont: span ? getComputedStyle(span).fontFamily : null,
          };
        }, t('home.heroPhrases.0.accent'));
        await info.attach('headline.json', { body: JSON.stringify(m, null, 2), contentType: 'application/json' });
        expect(m.pageScrolls).toBe(false);
        expect(m.overflows).toBe(false);
        expect(m.left).toBeGreaterThanOrEqual(0);
        expect(m.right).toBeLessThanOrEqual(m.viewport);
        expect(m.accentRight).not.toBeNull();
        expect(m.accentRight!).toBeLessThanOrEqual(m.viewport);
        // Orange: red well above blue, and not the colour of the rest.
        const [r, , b] = m.accentColor!;
        expect(r - b).toBeGreaterThan(100);
        expect(m.accentColor).not.toEqual(m.headlineColor);
        expect(m.accentFont).toMatch(/Newsreader/);
      });
    }
  }
});

test('X36 Home has no kicker above the headline and no "editor\'s pick" label', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(t('home.editorsPick'))).toHaveCount(0);
  await expect(page.getByText(t('home.featured'))).toBeVisible();
});

// Unfolding a Galaxy Fold widens the window under a running app (on the web
// the column grows from 344 to its 480 cap). What the person was doing has to
// survive it: the photo they swiped to, and the tab they picked.
test.describe('unfolding mid-session', () => {
  test.use({ viewport: { width: 344, height: 882 } });

  test('X37 the listing stays on the same photo, aligned, when the screen widens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone project only');
    await page.goto(`/property/${FEATURED.id}`);
    await ready(page);
    // The hero carousel: the horizontal scroller whose pages open the photos.
    // Scrolls it to `page` when given; returns where it is.
    const carousel = (to?: number) => page.evaluate(([label, to]) => {
      const el = [...document.querySelectorAll('div')].find((d) => {
        const s = getComputedStyle(d);
        return (s.overflowX === 'auto' || s.overflowX === 'scroll') && d.scrollWidth > d.clientWidth
          && d.querySelector(`[aria-label="${label}"]`);
      });
      // scrollLeft, not scrollTo(): the latter left this snapping scroller at 0.
      if (el && typeof to === 'number') el.scrollLeft = to * el.clientWidth;
      return el ? { left: Math.round(el.scrollLeft), width: el.clientWidth } : null;
    }, [t('listing.images'), to] as const);
    await expect.poll(() => carousel()).toEqual({ left: 0, width: 344 });
    // Swipe to the second photo.
    await carousel(1);
    await expect.poll(() => carousel()).toEqual({ left: 344, width: 344 });
    await page.waitForTimeout(600);

    await page.setViewportSize({ width: 690, height: 829 });
    // Still the second photo, a whole page in: not photo one, not half of each.
    // Each photo is a 480 page (the column), shown through a scroller 478
    // wide (the column's hairline edges), so page two starts at 480.
    await expect.poll(() => carousel()).toEqual({ left: 480, width: 478 });
  });

  test('X38 Explore keeps the chosen tab and its homes when the screen widens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone project only');
    await page.goto('/explore');
    await ready(page);
    await page.getByRole('button', { name: t('search.rent'), exact: true }).click();
    const rentals = LISTINGS.filter((l) => l.listing_type === 'rent').length;
    const count = page.getByText(/në shikim/);
    await expect(count).toContainText(String(rentals));
    await page.setViewportSize({ width: 690, height: 829 });
    await expect(page).toHaveURL(/\/explore/);
    await expect(count).toContainText(String(rentals));
    const background = (name: string) =>
      page.getByRole('button', { name, exact: true }).evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(await background(t('search.rent'))).not.toBe(await background(t('common.all')));
  });
});

// CRM, phase 1 (docs/BSP_CRM_ANALYSIS.md): the agent's leads, today's agenda
// and buyer requests matched against the agent's own listings.
test.describe('signed in: CRM', () => {
  test.use({ signedIn: true });

  const LEAD = {
    id: 'e2e00000-0000-4000-9000-000000000001',
    agent_id: SIGNED_IN_USER.id,
    name: 'Arben Hoxha',
    phone: '+355 69 123 4567',
    email: 'arben@example.com',
    notes: 'Kërkon 2+1 në Tiranë',
    status: 'new',
    created_at: '2026-10-20T10:00:00+00:00',
  };

  test('X39 leads: listed, searched, added, moved forward and deleted after a confirmation', async ({ page, writes }) => {
    const asked: string[] = [];
    await page.route('**/rest/v1/leads*', (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        asked.push(decodeURIComponent(req.url()));
        return json(route, [LEAD]);
      }
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        writes.push({ table: 'leads', method: 'POST', query: '', body });
        return json(route, { id: 'e2e00000-0000-4000-9000-000000000002', created_at: '2026-10-27T10:00:00+00:00', ...body }, 201);
      }
      const body = req.method() === 'DELETE' ? {} : req.postDataJSON();
      writes.push({ table: 'leads', method: req.method(), query: new URL(req.url()).search, body });
      return req.method() === 'DELETE' ? route.fulfill({ status: 204, body: '' }) : json(route, { ...LEAD, ...body });
    });
    await page.goto('/leads');
    await ready(page);
    await expect(page.getByText('Arben Hoxha')).toBeVisible();
    expect(asked[0]).toContain(`agent_id=eq.${SIGNED_IN_USER.id}`);
    expect(asked[0]).toMatch(/limit=24/);

    // Search runs in the database; a local number also matches the international one.
    await page.getByRole('textbox', { name: t('leads.search') }).fill('069 123');
    await expect.poll(() => asked.at(-1)).toContain('phone.ilike.*6*9*1*2*3*');

    // Add.
    await page.getByRole('button', { name: t('leads.add') }).first().click();
    await page.getByRole('textbox', { name: t('leads.name') }).fill('Elira Kola');
    await page.getByRole('textbox', { name: t('leads.phone') }).fill('068 555 0000');
    await page.getByRole('button', { name: t('common.save') }).click();
    await expect.poll(() => writes.find((w) => w.table === 'leads' && w.method === 'POST')?.body).toMatchObject({
      name: 'Elira Kola', phone: '068 555 0000', status: 'new', agent_id: SIGNED_IN_USER.id,
    });

    // Move forward in the pipeline: new -> contacted.
    // The card's button, not the filter chip of the same name at the top.
    await page.getByRole('button', { name: t('leads.status.contacted') }).last().click();
    await expect.poll(() => writes.find((w) => w.method === 'PATCH')?.body).toEqual({ status: 'contacted' });

    // Delete asks first.
    await page.getByRole('button', { name: t('leads.delete') }).last().click();
    await expect(page.getByText(t('leads.deleteTitle'))).toBeVisible();
    expect(writes.some((w) => w.method === 'DELETE')).toBe(false);
    await page.getByRole('button', { name: t('leads.delete') }).last().click();
    await expect.poll(() => writes.some((w) => w.table === 'leads' && w.method === 'DELETE')).toBe(true);
  });

  test('X40 leads: a lead needs a name, and a bad email is refused before saving', async ({ page, writes }) => {
    await page.route('**/rest/v1/leads*', (route) => (route.request().method() === 'GET' ? json(route, []) : route.fallback()));
    await page.goto('/leads');
    await ready(page);
    await expect(page.getByText(t('leads.empty'))).toBeVisible();
    await page.getByRole('button', { name: t('leads.add') }).first().click();
    await page.getByRole('button', { name: t('common.save') }).click();
    await expect(page.getByText(t('leads.nameRequired'))).toBeVisible();
    await page.getByRole('textbox', { name: t('leads.name') }).fill('Ana');
    await page.getByRole('textbox', { name: t('leads.email'), exact: true }).fill('ana@');
    await page.getByRole('button', { name: t('common.save') }).click();
    await expect(page.getByText(t('leads.emailInvalid'))).toBeVisible();
    expect(writes.some((w) => w.table === 'leads')).toBe(false);
  });

  test('X41 dashboard: today\'s agenda, the leads link, and buyer requests matched to your listings', async ({ page }) => {
    const today = new Date();
    today.setHours(17, 0, 0, 0);
    await page.route('**/rest/v1/viewings*', (route) =>
      json(route, [{
        id: 'e2e00000-0000-4000-8000-000000000001', client_id: CHAT_CLIENT_ID, agent_id: SIGNED_IN_USER.id,
        scheduled_at: today.toISOString(), status: 'confirmed', notes: null,
        property: { id: LISTINGS[0].id, title: LISTINGS[0].title, title_i18n: null, city: 'Tiranë' },
      }]));
    await page.route('**/rest/v1/wanted_homes*', (route) =>
      json(route, [{
        id: 'e2e00000-0000-4000-8000-000000000002', client_id: CHAT_CLIENT_ID, city: 'Tirana', listing_type: 'sale',
        max_price: 110000, min_bedrooms: 2, notes: null, status: 'open', created_at: '2026-10-25T10:00:00+00:00',
      }]));
    await page.goto('/agent-dashboard');
    await ready(page);
    await expect(page.getByText(t('agentDashboard.today'), { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`^17:00 ${escape(LISTINGS[0].title as string)}`) })).toBeVisible();

    // "Tirana" matches listings in "Tiranë"; the cheap 2-bedroom sale listing fits.
    const matchLine = page.getByText(/nga pronat e tua përputh/);
    await expect(matchLine).toBeVisible();
    await page.getByRole('button', { name: t('agentDashboard.showMatches') }).click();
    await expect(page.getByRole('link', { name: LISTINGS[0].title as string })).toBeVisible();

    await page.getByRole('button', { name: new RegExp(t('agentDashboard.statLeads')) }).click();
    await expect(page).toHaveURL(/\/leads$/);
  });
});

// The Shtëpia.ime assistant (docs/AI_ASSISTANT.md). The ai-assistant function
// is answered here, so these check the screen: what it sends, and that cards,
// tables and buttons come only from the server's answer.
test.describe('AI assistant', () => {
  test.skip(!AI_CHAT_ENABLED, 'AI chat is parked (constants/features.ts)');
  const card = (l: (typeof LISTINGS)[number]) => ({
    id: l.id, title: l.title, title_i18n: null, price: l.price, currency: l.currency, listing_type: l.listing_type,
    property_type: l.property_type, city: l.city, zone: null, address: l.address, sqft: l.sqft, beds: l.beds, baths: l.baths,
    floor: 3, total_floors: 8, features: ['elevator'], image_urls: (l.image_urls as string[]).slice(0, 1), ref_code: null,
    created_at: l.created_at, status: 'active',
  });
  const answer = (over: Record<string, unknown> = {}) => ({
    reply: 'Gjeta 2 apartamente në Tiranë brenda buxhetit.',
    cards: [card(LISTINGS[0]), card(LISTINGS[1])],
    comparison: null,
    screens: [],
    state: { criteria: { city: 'Tiranë', max_price_eur: 150000, min_beds: 2 }, result_ids: [LISTINGS[0].id, LISTINGS[1].id], seen_ids: [] },
    ...over,
  });

  test('X43 a starter question gets an answer with real listing cards that open the listing', async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route('**/functions/v1/ai-assistant', (route) => {
      bodies.push(route.request().postDataJSON());
      return json(route, answer());
    });
    await page.goto('/assistant');
    await ready(page);
    await expect(page.getByRole('heading', { name: t('aiAssistant.title'), level: 1 })).toBeVisible();
    await page.getByRole('button', { name: t('aiAssistant.starters.findApartment') }).click();
    await expect(page.getByText('Gjeta 2 apartamente në Tiranë brenda buxhetit.')).toBeVisible();
    expect(bodies[0]).toMatchObject({ messages: [{ role: 'user', content: t('aiAssistant.starters.findApartment') }], state: null, language: 'sq' });
    for (const l of [LISTINGS[0], LISTINGS[1]]) {
      await expect(page.getByRole('link', { name: new RegExp(escape(l.title as string)) }).first()).toBeVisible();
    }
    await page.getByRole('link', { name: new RegExp(escape(LISTINGS[1].title as string)) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/property/${LISTINGS[1].id}$`));
  });

  test('X44 a follow-up sends the earlier answer and the search state back; new chat clears both', async ({ page }) => {
    const bodies: { messages: { role: string; content: string }[]; state: unknown }[] = [];
    await page.route('**/functions/v1/ai-assistant', (route) => {
      bodies.push(route.request().postDataJSON());
      return json(route, bodies.length === 1 ? answer() : answer({ reply: 'Me ashensor mbetet një.', cards: [card(LISTINGS[0])] }));
    });
    await page.goto('/assistant');
    await ready(page);
    const box = page.getByRole('textbox', { name: t('aiAssistant.placeholder') });
    await box.fill('Dua një apartament 2+1 në Tiranë deri në 150 mijë euro.');
    await page.getByRole('button', { name: t('common.send') }).click();
    await expect(page.getByText('Gjeta 2 apartamente në Tiranë brenda buxhetit.')).toBeVisible();
    await box.fill('Po me ashensor?');
    await box.press('Enter');
    await expect(page.getByText('Me ashensor mbetet një.')).toBeVisible();
    expect(bodies[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(bodies[1].state).toEqual(answer().state);

    // The conversation survives a reload on this device…
    await page.reload();
    await ready(page);
    await expect(page.getByText('Me ashensor mbetet një.')).toBeVisible();
    // …until a new chat starts.
    await page.getByRole('button', { name: t('aiAssistant.newChat') }).click();
    await expect(page.getByText('Me ashensor mbetet një.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: t('aiAssistant.starters.compare') })).toBeVisible();
  });

  test('X45 a comparison is a table from the server, with "not specified" for missing values and screen buttons', async ({ page }) => {
    await page.route('**/functions/v1/ai-assistant', (route) =>
      json(route, answer({
        reply: 'E dyta ka çmimin më të ulët për m².',
        cards: [],
        comparison: {
          mixed_currencies: false,
          items: [
            { id: LISTINGS[0].id, title: LISTINGS[0].title, price: 150000, currency: 'EUR', price_eur_approx: 150000, area_m2: 100, price_per_m2: 1500, price_per_m2_eur_approx: 1500, bedrooms: 2, bathrooms: 1, floor: 3, building_floors: 8, city: 'Tiranë', zone: 'Blloku', features: ['elevator'], status: 'active' },
            { id: LISTINGS[1].id, title: LISTINGS[1].title, price: 120000, currency: 'EUR', price_eur_approx: 120000, area_m2: null, price_per_m2: null, price_per_m2_eur_approx: null, bedrooms: 2, bathrooms: null, floor: null, building_floors: null, city: 'Tiranë', zone: null, features: [], status: 'active' },
          ],
          best: { lowest_price: LISTINGS[1].id, largest_area: null, lowest_price_per_m2: null, most_bedrooms: null },
        },
        screens: [{ key: 'explore', route: '/explore' }],
      })),
    );
    await page.goto('/assistant');
    await ready(page);
    await page.getByRole('button', { name: t('aiAssistant.starters.compare') }).click();
    await expect(page.getByText(t('aiAssistant.compare.pricePerM2'), { exact: true })).toBeVisible();
    await expect(page.getByText(t('aiAssistant.compare.best.price'), { exact: true })).toBeVisible();
    await expect(page.getByText(t('aiAssistant.notSpecified')).first()).toBeVisible();
    await page.getByRole('button', { name: t('aiAssistant.screens.explore') }).click();
    await expect(page).toHaveURL(/\/explore$/);
  });

  test('X46 when the assistant is down the chat says so, and retry asks the same question again', async ({ page }) => {
    let calls = 0;
    await page.route('**/functions/v1/ai-assistant', (route) => {
      calls += 1;
      return calls === 1 ? json(route, { error: 'ai_unavailable' }, 503) : json(route, answer());
    });
    await page.goto('/assistant');
    await ready(page);
    await page.getByRole('button', { name: t('aiAssistant.starters.howItWorks') }).click();
    await expect(page.getByText(t('aiAssistant.error.unavailable'))).toBeVisible();
    await page.getByRole('button', { name: t('common.retry') }).click();
    await expect(page.getByText('Gjeta 2 apartamente në Tiranë brenda buxhetit.')).toBeVisible();
    await expect(page.getByText(t('aiAssistant.error.unavailable'))).toHaveCount(0);
    expect(calls).toBe(2);
  });

  test('X47 home and search lead to the assistant; a listing opens it with the question ready, not sent', async ({ page }) => {
    let calls = 0;
    await page.route('**/functions/v1/ai-assistant', (route) => {
      calls += 1;
      return json(route, answer());
    });
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: t('aiAssistant.entry') }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    await page.goto('/explore');
    await ready(page);
    await page.getByRole('button', { name: t('aiAssistant.title') }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    await page.goto(`/property/${LISTINGS[0].id}`);
    await ready(page);
    await page.getByRole('button', { name: t('assistant.title') }).click();
    await page.getByRole('button', { name: t('aiAssistant.alternatives') }).click();
    await expect(page).toHaveURL(new RegExp(`/assistant\\?property=${LISTINGS[0].id}`));
    await expect(page.getByRole('textbox', { name: t('aiAssistant.placeholder') })).toHaveValue(t('aiAssistant.alternativesQuestion'));
    expect(calls).toBe(0);
  });
});

test('X48 a tapped photo opens full screen and is actually drawn there, not collapsed to no height', async ({ page }) => {
  await page.goto(`/property/${FEATURED.id}`);
  await ready(page);
  await page.getByRole('img', { name: FEATURED.title as string }).first().click();
  await expect(page.getByRole('button', { name: t('common.close') })).toBeVisible();
  // The viewer's photos carry the listing title; the last ones in the page
  // are the viewer's (it is rendered after the screen).
  const shown = page.getByRole('img', { name: FEATURED.title as string }).last();
  const box = await shown.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(200);
});

test.describe('signed in, a listing someone else posted', () => {
  test.use({ signedIn: true });

  test('X49 "Chat" with the suggested message untouched sends that message, not nothing', async ({ page, writes }) => {
    // The box shows the suggestion as its placeholder; the button was
    // disabled until something was typed, under a box that looked filled in.
    const listing = LISTINGS.find((l) => !l.agent)!;
    const suggested = t('property.whatsappMessage').replace('{{title}}', listing.title);
    await page.goto(`/property/${listing.id}`);
    await ready(page);
    const chat = page.getByRole('button', { name: t('detail.chatInApp') });
    await expect(chat).toBeEnabled();
    await chat.click();
    await expect.poll(() => writes.find((w) => w.table === 'messages')?.method).toBe('POST');
    expect(writes.find((w) => w.table === 'messages')?.body).toMatchObject({ body: suggested });
  });
});

test.describe('signed in, the listing chat message is refused', () => {
  test.use({ signedIn: true, allowConsoleErrors: [/status of 403/] });

  test('X63 a refused message says it was not sent and keeps the text, never "sent"', async ({ page }) => {
    // QA-03: the insert's error was ignored, so a refused message (a block,
    // offline, the server's checks) still showed the "sent" tick.
    await page.route('**/rest/v1/messages*', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }) })
        : route.fallback(),
    );
    const listing = LISTINGS.find((l) => !l.agent)!;
    await page.goto(`/property/${listing.id}`);
    await ready(page);
    const box = page.getByPlaceholder(t('property.whatsappMessage').replace('{{title}}', listing.title));
    await box.fill('A është ende në shitje?');
    await page.getByRole('button', { name: t('detail.chatInApp') }).click();
    await expect(page.getByText(t('messages.sendFailed'))).toBeVisible();
    await expect(page.getByText(`${t('detail.message')} ✓`)).toHaveCount(0);
    await expect(box).toHaveValue('A është ende në shitje?');
    await expect(page.getByRole('button', { name: t('detail.chatInApp') })).toBeEnabled();
  });
});

// The listing assistant answers only from the listing. When the listing does
// not hold the answer (the server sends contact: true), or the assistant is
// down, the seller's contact is shown under the reply instead of a dead end.
test.describe('listing assistant hands over to the seller', () => {
  test.skip(!AI_CHAT_ENABLED, 'AI chat is parked (constants/features.ts)');
  const ask = async (page: Page, question: string) => {
    await page.getByPlaceholder(t('assistant.placeholder')).fill(question);
    await page.getByRole('button', { name: t('common.send') }).click();
  };
  const callButton = (page: Page) => page.getByRole('button', { name: `${t('property.call')}, ${AGENT.full_name}` });

  test('X50 an answer the listing lacks shows the agent with Call and WhatsApp; an answer it has does not', async ({ page }) => {
    let turn = 0;
    await page.route('**/functions/v1/ai-listing-assistant', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*' } })
        : json(route, ++turn === 1
          ? { reply: 'Shpallja nuk e thotë nëse ka parkim.', contact: true }
          : { reply: 'Ka 2 dhoma gjumi.', contact: false }),
    );
    await page.goto(`/property/${FEATURED.id}`);
    await ready(page);
    await page.getByRole('button', { name: t('assistant.title') }).click();

    await ask(page, 'A ka parkim?');
    await expect(page.getByText('Shpallja nuk e thotë nëse ka parkim.')).toBeVisible();
    await expect(page.getByText(t('assistant.contactTitle'))).toHaveCount(1);
    await expect(callButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: `WhatsApp, ${AGENT.full_name}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${t('assistant.viewProfile')}, ${AGENT.full_name}` })).toBeVisible();

    await ask(page, 'Sa dhoma ka?');
    await expect(page.getByText('Ka 2 dhoma gjumi.')).toBeVisible();
    await expect(page.getByText(t('assistant.contactTitle'))).toHaveCount(1);
  });

  test('X51 when the assistant is down the seller is still offered', async ({ page }) => {
    // The fake backend answers every Edge Function with 503 ai_unavailable.
    await page.goto(`/property/${FEATURED.id}`);
    await ready(page);
    await page.getByRole('button', { name: t('assistant.title') }).click();
    await ask(page, 'A ka ashensor?');
    await expect(page.getByText(t('assistant.unavailable'))).toBeVisible();
    await expect(callButton(page)).toBeVisible();
  });
});

// AI chat is parked (DECISIONS.md C2): none of its entry points shows, and an
// old /assistant link lands on Home.
test.describe('AI chat switched off', () => {
  test.skip(AI_CHAT_ENABLED, 'AI chat is switched on');

  test('X52 no AI chat on Home, Search or a listing, and /assistant goes Home', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await expect(page.getByText(t('aiAssistant.entry'))).toHaveCount(0);
    await page.goto('/explore');
    await ready(page);
    await expect(page.getByRole('button', { name: t('aiAssistant.title') })).toHaveCount(0);
    await page.goto(`/property/${FEATURED.id}`);
    await ready(page);
    await expect(page.getByRole('button', { name: t('assistant.title') })).toHaveCount(0);
    await page.goto('/assistant');
    await expect(page).toHaveURL(/\/$/);
  });
});

// react-native-web's Alert.alert is an empty function: dialogs built on it
// never appeared in the web build, so these actions silently did nothing
// (docs/PRE_PURCHASE_QA.md). lib/confirm.ts asks with the browser's dialog.
test.describe('web confirmations actually ask and act', () => {
  test.describe('signed in', () => {
    test.use({ signedIn: true });

    test('X74 deleting a saved search asks first: cancel keeps it, confirm deletes it', async ({ page, writes }) => {
      await page.goto('/saved-searches');
      await ready(page);
      const del = page.getByRole('button', { name: t('saved.delete') }).first();
      await expect(del).toBeVisible();

      page.once('dialog', (d) => d.dismiss());
      await del.click();
      await page.waitForTimeout(300);
      expect(writes.filter((w) => w.method === 'DELETE')).toHaveLength(0);

      page.once('dialog', (d) => d.accept());
      await del.click();
      await expect.poll(() => writes.filter((w) => w.table === 'saved_searches' && w.method === 'DELETE').length).toBe(1);
    });

    test('X75 each listing action shows its word, not only a picture', async ({ page }) => {
      await page.goto('/my-listings');
      await ready(page);
      for (const word of [t('listing.actionView'), t('listing.edit'), t('listing.actionStats'), t('listing.delete')]) {
        await expect(page.getByText(word, { exact: true }).first()).toBeVisible();
      }
    });

    test('X53 deleting a listing asks first: cancel keeps it, confirm deletes it', async ({ page, writes }) => {
      await page.goto('/my-listings');
      await ready(page);
      const deletes = page.getByRole('button', { name: t('listing.delete') });
      await expect(deletes.first()).toBeVisible();
      const before = await deletes.count();
      expect(before).toBeGreaterThan(0);

      page.once('dialog', (d) => d.dismiss());
      await deletes.first().click();
      await page.waitForTimeout(300);
      expect(writes.filter((w) => w.method === 'DELETE')).toHaveLength(0);

      page.once('dialog', (d) => d.accept());
      await deletes.first().click();
      await expect.poll(() => writes.filter((w) => w.table === 'properties' && w.method === 'DELETE').length).toBe(1);
      expect(writes.find((w) => w.method === 'DELETE')?.query).toMatch(/id=eq\./);
      await expect(deletes).toHaveCount(before - 1);
    });

    test('X55 the chat menu opens on the web with Report and Block', async ({ page }) => {
      await page.route(`**/rest/v1/profiles*id=eq.${CHAT_CLIENT_ID}*`, (route) =>
        json(route, { full_name: 'Ana Klientja', agency_name: null }),
      );
      await page.goto(`/messages/${CONVERSATIONS[0].id}`);
      await ready(page);
      await page.getByRole('button', { name: t('safety.menu') }).click();
      await expect(page.getByRole('menuitem', { name: t('safety.reportUser') })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: t('safety.blockUser') })).toBeVisible();
      await page.getByRole('menuitem', { name: t('common.cancel') }).click();
      await expect(page.getByRole('menuitem', { name: t('safety.reportUser') })).toHaveCount(0);
    });
  });

  test('X54 signed out, booking a viewing asks to sign in and goes there', async ({ page }) => {
    await page.goto(`/property/${FEATURED.id}`);
    await ready(page);
    const message = new Promise<string>((resolve) =>
      page.once('dialog', (d) => {
        resolve(d.message());
        void d.accept();
      }),
    );
    await page.getByRole('button', { name: t('detail.scheduleViewing') }).click();
    expect(await message).toContain(t('favourites.loginPrompt'));
    await expect(page).toHaveURL(/\/profile$/);
  });
});

// Sign-up verification in the app (owner spec 2026-11-07): Office Name for
// agents, the "Verify your email" step with a 10-minute countdown, wrong and
// expired codes told apart, a cap on wrong guesses, resend, a registered
// address stopped at the form, and nothing behind sign-in for an unverified
// address. Supabase holds the code (hashed, single use).
const SIGNUP_EMAIL = 'new.user@example.com';
const SIGNUP_PASSWORD = 'correct-horse-battery';
const PENDING_USER = { id: SIGNED_IN_USER.id, aud: 'authenticated', email: SIGNUP_EMAIL, identities: [{ provider: 'email' }] };
const CODE_REFUSED = { code: 'otp_expired', msg: 'Token has expired or is invalid' };
const digit = (n: number) => t('auth.codeDigit').replace('{{n}}', String(n));

type AuthCall = { path: string; body: Record<string, unknown> };
async function answerAuth(page: Page, path: string, answer: () => [number, unknown], calls: AuthCall[]) {
  await page.route(`**/auth/v1/${path}*`, (route) => {
    let body: Record<string, unknown> = {};
    try { body = route.request().postDataJSON() ?? {}; } catch { /* no body */ }
    calls.push({ path, body });
    const [status, reply] = answer();
    return json(route, reply, status);
  });
}

async function signUpInApp(page: Page, { agent = false, office = '' } = {}) {
  await page.goto('/profile');
  await ready(page);
  await page.getByRole('button', { name: new RegExp(t('common.signUp')) }).click();
  if (agent) await page.getByRole('button', { name: new RegExp(t('auth.roleAgent')) }).click();
  await page.getByRole('textbox', { name: t('auth.fullName') }).fill('Ana Hoxha');
  await page.getByRole('textbox', { name: t('auth.email') }).fill(SIGNUP_EMAIL);
  await page.getByLabel(t('auth.password'), { exact: true }).fill(SIGNUP_PASSWORD);
  await page.getByLabel(t('auth.confirmPassword'), { exact: true }).fill(SIGNUP_PASSWORD);
  if (agent) await page.getByRole('textbox', { name: t('auth.officeName') }).fill(office);
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
}

async function typeAppCode(page: Page, code: string) {
  for (const [i, d] of [...code].entries()) await page.getByRole('textbox', { name: digit(i + 1) }).fill(d);
}

test.describe('sign-up verification', () => {
  test.use({ allowConsoleErrors: [/status of 403/, /status of 422/] });

  test('X56 an agent signs up with an office, verifies with the code and is signed in', async ({ page }) => {
    const calls: AuthCall[] = [];
    await answerAuth(page, 'signup', () => [200, PENDING_USER], calls);
    await answerAuth(page, 'verify', () => [200, fakeSession()], calls);
    await page.route('**/auth/v1/user*', (route) => json(route, SIGNED_IN_USER));
    await signUpInApp(page, { agent: true, office: ' ' });
    await expect(page.getByText(t('errors.officeRequired'))).toBeVisible();
    expect(calls).toEqual([]);

    await page.getByRole('textbox', { name: t('auth.officeName') }).fill(' Zyra Tirana ');
    await page.getByRole('button', { name: t('auth.createAccount') }).click();
    await expect(page.getByRole('heading', { name: t('auth.verifyEmailTitle') })).toBeVisible();
    await expect(page.getByText(t('auth.verifyEmailSubtitle'))).toBeVisible();
    await expect(page.getByText(t('auth.codeExpiresIn').replace('{{time}}', '10:00'))).toBeVisible();
    expect(calls[0].body).toMatchObject({ email: SIGNUP_EMAIL, data: { role: 'agent', full_name: 'Ana Hoxha', agency_name: 'Zyra Tirana' } });
    // color-contrast: only the selected Agent pill above, white on solid
    // orange, the open issue listed in e2e-expo/a11y.spec.ts KNOWN. The code
    // screen's own text passed the rule when checked on its own.
    expect(await axeViolations(page, { known: ['color-contrast'] })).toEqual([]);

    await typeAppCode(page, '12345');
    await expect(page.getByRole('button', { name: t('auth.verifyAccount') })).toBeDisabled();
    await page.getByRole('textbox', { name: digit(6) }).fill('6');
    await expect(page.getByRole('heading', { name: t('common.profile'), level: 1 })).toBeVisible();
    expect(calls.filter((c) => c.path === 'verify').map((c) => c.body)).toEqual([
      expect.objectContaining({ email: SIGNUP_EMAIL, token: '123456', type: 'signup' }),
    ]);
  });

  test('X57 a wrong code says so; all six digits pasted at once verify', async ({ page }) => {
    const calls: AuthCall[] = [];
    let n = 0;
    await answerAuth(page, 'signup', () => [200, PENDING_USER], calls);
    await answerAuth(page, 'verify', () => (++n === 1 ? [403, CODE_REFUSED] : [200, fakeSession()]), calls);
    await page.route('**/auth/v1/user*', (route) => json(route, SIGNED_IN_USER));
    await signUpInApp(page);
    await typeAppCode(page, '000000');
    await expect(page.getByText(t('errors.codeIncorrect'))).toBeVisible();
    await expect(page.getByRole('textbox', { name: digit(1) })).toHaveValue('');
    // A paste lands as one six-character change on the first box.
    await page.getByRole('textbox', { name: digit(1) }).fill('654321');
    await expect(page.getByRole('heading', { name: t('common.profile'), level: 1 })).toBeVisible();
    expect(calls.filter((c) => c.path === 'verify').map((c) => c.body.token)).toEqual(['000000', '654321']);
  });

  test('X58 after five wrong codes the sixth is not sent', async ({ page }) => {
    const calls: AuthCall[] = [];
    await answerAuth(page, 'signup', () => [200, PENDING_USER], calls);
    await answerAuth(page, 'verify', () => [403, CODE_REFUSED], calls);
    await signUpInApp(page);
    for (let i = 1; i <= 5; i++) {
      await typeAppCode(page, `00000${i}`);
      await expect.poll(() => calls.filter((c) => c.path === 'verify').length).toBe(i);
    }
    await expect(page.getByText(t('errors.codeAttempts'))).toBeVisible();
    await typeAppCode(page, '000006');
    await expect(page.getByText(t('errors.codeAttempts'))).toBeVisible();
    expect(calls.filter((c) => c.path === 'verify')).toHaveLength(5);
  });

  test('X59 an expired code is not sent and says so; a resent code starts a new 10 minutes', async ({ page }) => {
    const calls: AuthCall[] = [];
    await page.clock.install();
    await answerAuth(page, 'signup', () => [200, PENDING_USER], calls);
    await answerAuth(page, 'resend', () => [200, {}], calls);
    await answerAuth(page, 'verify', () => [200, fakeSession()], calls);
    await page.route('**/auth/v1/user*', (route) => json(route, SIGNED_IN_USER));
    await signUpInApp(page);
    await expect(page.getByText(t('auth.codeExpiresIn').replace('{{time}}', '10:00'))).toBeVisible();
    await page.clock.runFor('09:00');
    await expect(page.getByText(t('auth.codeExpiresIn').replace('{{time}}', '1:00'))).toBeVisible();
    await page.clock.runFor('01:01');
    await expect(page.getByText(t('errors.codeExpired'))).toBeVisible();
    await expect(page.getByRole('button', { name: t('auth.verifyAccount') })).toBeDisabled();
    await typeAppCode(page, '123456');
    await expect(page.getByText(t('errors.codeExpired'))).toBeVisible();
    expect(calls.filter((c) => c.path === 'verify')).toEqual([]);

    await page.getByRole('button', { name: t('auth.resendCode') }).click();
    await expect(page.getByText(t('auth.newCodeSent'))).toBeVisible();
    expect(calls.find((c) => c.path === 'resend')?.body).toMatchObject({ email: SIGNUP_EMAIL, type: 'signup' });
    await expect(page.getByText(t('auth.codeExpiresIn').replace('{{time}}', '10:00'))).toBeVisible();
    await typeAppCode(page, '123456');
    await expect(page.getByRole('heading', { name: t('common.profile'), level: 1 })).toBeVisible();
  });

  test('X60 an address that already has an account is stopped at the form', async ({ page }) => {
    const calls: AuthCall[] = [];
    // Supabase's answer for a registered address: a look-alike user with no
    // identities, no session and no email sent.
    await answerAuth(page, 'signup', () => [200, { id: 'decoy', aud: 'authenticated', email: SIGNUP_EMAIL, identities: [] }], calls);
    await signUpInApp(page);
    await expect(page.getByText(t('errors.userExists'))).toBeVisible();
    await expect(page.getByRole('button', { name: t('auth.createAccount') })).toBeVisible();
    await expect(page.getByRole('heading', { name: t('auth.verifyEmailTitle') })).toHaveCount(0);
  });

  test('X61 the dashboard stays shut while the email is unverified', async ({ page }) => {
    const calls: AuthCall[] = [];
    await answerAuth(page, 'signup', () => [200, PENDING_USER], calls);
    await signUpInApp(page);
    await expect(page.getByRole('heading', { name: t('auth.verifyEmailTitle') })).toBeVisible();
    await page.goto('/agent-dashboard');
    await ready(page);
    await expect(page.getByText(t('addSheet.signInFirst'))).toBeVisible();
  });

  test('X62 a stored session for an unverified address is refused and dropped', async ({ page }) => {
    const unverified = { ...SIGNED_IN_USER, email_confirmed_at: undefined };
    await page.addInitScript(
      ([key, session]) => localStorage.setItem(key, session),
      [SESSION_STORAGE_KEY, JSON.stringify({ ...fakeSession(), user: unverified })] as const,
    );
    await page.route('**/auth/v1/user*', (route) => json(route, unverified));
    await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, headers: CORS, body: '' }));
    await page.goto('/agent-dashboard');
    await ready(page);
    await expect(page.getByText(t('addSheet.signInFirst'))).toBeVisible();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SESSION_STORAGE_KEY)).toBeNull();
  });
});

// Raporti im (docs/PERFORMANCE_REPORT.md): the agent's private performance
// report. The database's own privacy checks are supabase/tests/
// rls_performance_report.sql; these check what the app shows and sends.
test.describe('performance report', () => {
  test.use({ signedIn: true });
  const reportCalls = (writes: { table: string; body: Record<string, unknown> }[]) =>
    writes.filter((w) => w.table === 'rpc/my_performance_report');

  test('X66 the dashboard opens the report, which shows counts and sends no agent id', async ({ page, writes }) => {
    await page.goto('/agent-dashboard');
    await ready(page);
    await page.getByRole('button', { name: new RegExp(escape(t('performance.entry'))) }).click();
    await expect(page).toHaveURL(/\/performance$/);
    await expect(page.getByRole('heading', { name: t('performance.sections.deals') })).toBeVisible();
    const { deals, contact, viewings } = PERFORMANCE_REPORT;
    await expect(page.getByLabel(`${t('performance.metrics.transactions')}: ${deals.sales + deals.rentals}`)).toBeVisible();
    await expect(page.getByLabel(`${t('performance.metrics.messagesSent')}: ${contact.messages_sent}`)).toBeVisible();
    await expect(page.getByLabel(`${t('performance.metrics.viewingsCancelled')}: ${viewings.cancelled}`)).toBeVisible();
    await expect(page.getByText(t('performance.privateNote'))).toBeVisible();
    // Achievements from the all-time counts: 12 listings is past ten.
    await expect(page.getByText(t('performance.achievements.tenListings'))).toBeVisible();
    // The report is asked for with a period and a time zone, never an id.
    const calls = reportCalls(writes);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(Object.keys(c.body).sort()).toEqual(['p_from', 'p_to', 'p_tz']);
  });

  test('X67 each period sends its own dates; a backwards custom range is refused', async ({ page, writes }) => {
    await page.goto('/performance');
    await ready(page);
    const last = () => reportCalls(writes).at(-1)?.body ?? {};
    // Opens on this month: from the 1st, up to now.
    await expect.poll(() => reportCalls(writes).length).toBeGreaterThan(0);
    expect(new Date(last().p_from as string).getDate()).toBe(1);
    expect(last().p_to).toBeNull();

    await page.getByRole('button', { name: t('performance.periods.all'), exact: true }).click();
    await expect.poll(() => last().p_from).toBeNull();

    await page.getByRole('button', { name: t('performance.periods.week'), exact: true }).click();
    await expect.poll(() => (last().p_from ? new Date(last().p_from as string).getDay() : -1)).toBe(1);

    await page.getByRole('button', { name: t('performance.periods.custom'), exact: true }).click();
    await page.getByLabel(t('performance.from'), { exact: true }).fill('2026-10-01');
    await page.getByLabel(t('performance.to'), { exact: true }).fill('2026-10-31');
    // Whole days: 1 October up to the start of 1 November.
    await expect.poll(() => last().p_to).toBe(new Date(2026, 10, 1).toISOString());
    expect(last().p_from).toBe(new Date(2026, 9, 1).toISOString());

    const before = reportCalls(writes).length;
    await page.getByLabel(t('performance.from'), { exact: true }).fill('2026-11-05');
    await expect(page.getByText(t('performance.customInvalid'))).toBeVisible();
    await page.waitForTimeout(300);
    expect(reportCalls(writes)).toHaveLength(before);
  });

  test('X68 the before estimate is the agent own, kept apart, and saved only once confirmed', async ({ page, writes }) => {
    await page.goto('/performance');
    await ready(page);
    await expect(page.getByText(t('performance.impact.disclaimer'))).toBeVisible();
    // Two of the four estimates were never entered: shown as such, not as 0.
    await expect(page.getByText(t('performance.impact.notEntered'), { exact: true })).toHaveCount(2);

    await page.getByRole('button', { name: t('performance.impact.edit') }).click();
    const sales = page.getByRole('textbox', { name: t('performance.impact.rows.sales') });
    const confirm = page.getByRole('checkbox', { name: t('performance.baseline.confirm') });
    const save = page.getByRole('button', { name: t('performance.baseline.save') });
    const saved = () => writes.filter((w) => w.table === 'agent_performance_baselines');

    await sales.fill('abc');
    await confirm.click();
    await save.click();
    await expect(page.getByText(t('performance.baseline.invalid'))).toBeVisible();

    await sales.fill('3');
    await confirm.click(); // unticked again
    await save.click();
    await expect(page.getByText(t('performance.baseline.mustConfirm'))).toBeVisible();
    expect(saved()).toHaveLength(0);

    await confirm.click();
    await save.click();
    await expect.poll(() => saved().length).toBe(1);
    expect(saved()[0].body).toEqual({
      agent_id: SIGNED_IN_USER.id,
      monthly_rentals: null,
      monthly_sales: 3,
      monthly_inquiries: 2,
      monthly_viewings: null,
    });
  });

  test('X69 a client signed in gets no report and asks for none', async ({ page, writes }) => {
    await page.route('**/rest/v1/profiles*', (route) => {
      const row = { id: SIGNED_IN_USER.id, role: 'buyer', full_name: 'Ana Klientja', agency_name: null, avatar_url: null, preferred_language: 'sq' };
      const one = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(route, one ? row : [row]);
    });
    await page.goto('/performance');
    await ready(page);
    await expect(page.getByText(t('performance.agentsOnly'))).toBeVisible();
    await page.waitForTimeout(300);
    expect(reportCalls(writes)).toHaveLength(0);
  });

  test('X70 marking a listing sold asks first: cancel changes nothing, confirm marks it', async ({ page, writes }) => {
    await page.goto('/my-listings');
    await ready(page);
    const mark = page.getByRole('button', { name: t('listing.markSold') }).first();
    await expect(mark).toBeVisible();
    const marked = () => writes.filter((w) => w.table === 'properties' && w.method === 'PATCH' && w.body.status === 'sold');

    page.once('dialog', (d) => {
      expect(d.message()).toContain(t('listing.confirmSoldTitle'));
      return d.dismiss();
    });
    await mark.click();
    await page.waitForTimeout(300);
    expect(marked()).toHaveLength(0);

    page.once('dialog', (d) => d.accept());
    await mark.click();
    await expect.poll(() => marked().length).toBe(1);
  });

  test('X71 a confirmed viewing whose time has passed can be recorded as completed', async ({ page, writes }) => {
    const base = {
      property_id: LISTINGS[0].id,
      client_id: CHAT_CLIENT_ID,
      agent_id: SIGNED_IN_USER.id,
      duration_minutes: 30,
      notes: null,
      created_at: '2026-10-01T09:00:00Z',
      property: null,
    };
    await page.route('**/rest/v1/viewings*', (route) =>
      route.request().method() === 'GET'
        ? json(route, [
            { ...base, id: 'e2e00000-0000-4000-d000-0000000000a1', scheduled_at: new Date(Date.now() - 86_400_000).toISOString(), status: 'confirmed' },
            { ...base, id: 'e2e00000-0000-4000-d000-0000000000a2', scheduled_at: new Date(Date.now() + 86_400_000).toISOString(), status: 'confirmed' },
          ])
        : route.fallback(),
    );
    await page.goto('/viewings');
    await ready(page);
    // Only the past one offers it.
    await expect(page.getByRole('button', { name: t('viewings.markCompleted') })).toHaveCount(1);
    await expect(page.getByRole('button', { name: t('viewings.markNoShow') })).toHaveCount(1);
    await page.getByRole('button', { name: t('viewings.markCompleted') }).click();
    await expect
      .poll(() => writes.filter((w) => w.table === 'viewings' && w.method === 'PATCH').map((w) => w.body.status))
      .toEqual(['completed']);
    await expect(page.getByText(t('viewings.status.completed'))).toBeVisible();
  });
});

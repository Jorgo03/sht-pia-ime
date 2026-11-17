import type { Page, Route } from '@playwright/test';

import { AGENT, CONVERSATIONS, LISTINGS } from '../e2e/support/fixtures';
import { SIGNED_IN_USER } from '../e2e/support/backend';
import { t } from '../e2e/support/i18n';
import { expect, test } from '../e2e/support/test';

// The website-wide audit (docs/WEBSITE_COMPLETE_AUDIT.md): every route, as a
// visitor, a client and an agent, at the brief's screen sizes. Each visit
// fails on a page error, a console error or a 5xx (the shared guard), and
// here also on a blank page, a page wider than the window, a control off
// screen, a broken image, a stretched photo, or a private page shown to a
// visitor. It records every link it sees, image sharpness and a screenshot at
// one desktop and one phone size, for the audit's inventory and visual QA.
// Runs on the desktop project only: each test sets its own window size.

// Screenshots land here; each test's measurements are attached to the report
// (run with --reporter=json) as "audit.json".
const SHOTS = 'qa-screens';

const LISTING = LISTINGS[0].id;
const CONV = CONVERSATIONS[0].id;

type Access = 'public' | 'signed-in' | 'agent';
type RouteSpec = { path: string; name: string; access: Access };

/** Every page of the website (app/ routes), dynamic ones with real fixture ids. */
export const ROUTES: RouteSpec[] = [
  { path: '/', name: 'home', access: 'public' },
  { path: '/explore', name: 'explore', access: 'public' },
  { path: '/explore?city=Tiran%C3%AB', name: 'explore-city', access: 'public' },
  { path: '/wanted', name: 'wanted', access: 'public' },
  { path: '/agents', name: 'agents', access: 'public' },
  { path: `/agent/${AGENT.id}`, name: 'agent-profile', access: 'public' },
  { path: `/user/${AGENT.id}`, name: 'user-profile', access: 'public' },
  { path: `/property/${LISTING}`, name: 'property', access: 'public' },
  { path: '/compare', name: 'compare', access: 'public' },
  { path: '/guide', name: 'guide', access: 'public' },
  { path: '/privacy', name: 'privacy', access: 'public' },
  { path: '/terms', name: 'terms', access: 'public' },
  { path: '/cookies', name: 'cookies', access: 'public' },
  { path: '/pricing', name: 'pricing', access: 'public' },
  { path: '/profile', name: 'profile', access: 'public' },
  { path: '/no-such-page', name: 'not-found', access: 'public' },
  { path: '/messages', name: 'messages', access: 'signed-in' },
  { path: `/messages/${CONV}`, name: 'chat', access: 'signed-in' },
  { path: '/favorites', name: 'favorites', access: 'signed-in' },
  { path: '/saved-searches', name: 'saved-searches', access: 'signed-in' },
  { path: '/viewings', name: 'viewings', access: 'signed-in' },
  { path: '/notifications', name: 'notifications', access: 'signed-in' },
  { path: '/my-listings', name: 'my-listings', access: 'signed-in' },
  { path: '/listing/new', name: 'listing-new', access: 'signed-in' },
  { path: '/blocked-users', name: 'blocked-users', access: 'signed-in' },
  { path: '/agent-dashboard', name: 'agent-dashboard', access: 'agent' },
  { path: '/leads', name: 'leads', access: 'agent' },
  { path: '/performance', name: 'performance', access: 'agent' },
  { path: '/listing/import', name: 'listing-import', access: 'agent' },
  { path: `/listing/${LISTING}/edit`, name: 'listing-edit', access: 'agent' },
  { path: `/listing/${LISTING}/analytics`, name: 'listing-analytics', access: 'agent' },
];

const SIZES: [number, number][] = [
  [1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1024, 768],
  [768, 1024], [430, 932], [390, 844], [375, 812], [360, 800],
];
const SHOT_SIZES = new Set(['1440x900', '390x844']);

type Role = 'visitor' | 'client' | 'agent';

async function asClient(page: Page) {
  await page.route('**/rest/v1/profiles*', (route: Route) => {
    const row = { id: SIGNED_IN_USER.id, role: 'buyer', full_name: 'Ana Klientja', agency_name: null, avatar_url: null, preferred_language: 'sq', phone: null };
    const one = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(one ? row : [row]) });
  });
}

/** What the page looks like once settled: the audit's measurements. */
function measure(page: Page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.opacity === '0' || s.visibility === 'hidden' || s.display === 'none') return false;
      }
      return true;
    };
    const inScroller = (el: Element) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll' || ox === 'hidden') && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };
    const offScreen: string[] = [];
    for (const el of document.querySelectorAll('[role=button],[role=link],a,button,input,textarea')) {
      if (!shown(el) || inScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > W + 1) offScreen.push(`${(el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).slice(0, 40)} ${Math.round(r.left)}-${Math.round(r.right)}`);
    }
    const images = [...document.querySelectorAll('img')].filter(shown).map((img) => {
      const r = img.getBoundingClientRect();
      const fit = getComputedStyle(img).objectFit;
      const natural = img.naturalWidth / Math.max(1, img.naturalHeight);
      const box = r.width / Math.max(1, r.height);
      return {
        src: img.currentSrc.slice(0, 120),
        broken: img.complete && img.naturalWidth === 0,
        // Drawn into a box of another shape without cover/contain: squashed.
        stretched: img.naturalWidth > 0 && fit === 'fill' && Math.abs(natural - box) / box > 0.06,
        // Fewer source pixels than screen pixels by a wide margin: soft or pixelated.
        lowRes: img.naturalWidth > 0 && img.naturalWidth < r.width * Math.min(window.devicePixelRatio, 2) * 0.6,
        size: `${img.naturalWidth}x${img.naturalHeight} in ${Math.round(r.width)}x${Math.round(r.height)}`,
      };
    });
    const links = [...document.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).getAttribute('href') || '');
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;
    return {
      title: document.title,
      textLength: document.body.innerText.trim().length,
      pageWider: document.documentElement.scrollWidth > W + 1,
      offScreen,
      images,
      links: [...new Set(links)],
      robots,
      h1: document.querySelectorAll('h1,[role=heading][aria-level="1"]').length,
    };
  });
}

for (const role of ['visitor', 'client', 'agent'] as Role[]) {
  test.describe(`audit as ${role}`, () => {
    // The 404 page's own status is logged by the browser as an error.
    test.use({ signedIn: role !== 'visitor', allowConsoleErrors: [/status of 404/] });

    for (const spec of ROUTES) {
      // A visitor sees every page (private ones must ask to sign in); a client
      // every page except the agent tools, which must say they are for agents.
      test(`AUD ${role} ${spec.name}`, async ({ page, isMobile }, info) => {
        test.skip(isMobile, 'desktop project: each test sets its own window size');
        test.setTimeout(180_000);
        if (role === 'client') await asClient(page);
        // The fake backend answers unknown addresses with the 404 page.
        const sizes = role === 'visitor' && spec.access === 'public' ? SIZES : SIZES.filter(([w]) => [1920, 1440, 1024, 768, 390, 360].includes(w));
        const results: Record<string, unknown> = {};
        for (const [w, h] of sizes) {
          await page.setViewportSize({ width: w, height: h });
          const response = await page.goto(spec.path);
          await page.waitForLoadState('networkidle');
          await expect(page.getByTestId('site-header')).toBeVisible();
          await page.waitForTimeout(400);
          const m = await measure(page);
          results[`${w}x${h}`] = { status: response?.status(), ...m };
          const key = `${w}x${h}`;
          if (SHOT_SIZES.has(key)) {
            await page.screenshot({ path: `${SHOTS}/${role}--${spec.name}--${key}.jpg`, type: 'jpeg', quality: 60, fullPage: false });
          }

          // Not blank, not wider than the window, nothing off screen, no broken or squashed image.
          expect.soft(m.textLength, `${spec.path} at ${key} is blank`).toBeGreaterThan(40);
          expect.soft(m.pageWider, `${spec.path} at ${key} is wider than the window`).toBe(false);
          expect.soft(m.offScreen, `${spec.path} at ${key}: controls off screen`).toEqual([]);
          expect.soft(m.images.filter((i) => i.broken).map((i) => i.src), `${spec.path} at ${key}: broken images`).toEqual([]);
          expect.soft(m.images.filter((i) => i.stretched).map((i) => i.size), `${spec.path} at ${key}: stretched images`).toEqual([]);

          // Authorisation by address: private pages ask a visitor to sign in;
          // agent tools tell a client they are for agents.
          if (role === 'visitor' && spec.access !== 'public') {
            // The page's own sign-in button (the header's is a link).
            await expect.soft(page.getByRole('button', { name: t('common.signIn'), exact: true }).first()).toBeVisible();
          }
          if (role === 'client' && spec.access === 'agent' && !spec.path.includes('/listing/')) {
            await expect.soft(page.getByText(spec.path === '/performance' ? t('performance.agentsOnly') : spec.path === '/listing/import' ? t('import.agentsOnly') : t('site.agentsOnly')).first()).toBeVisible();
          }
        }
        await info.attach('audit.json', {
          body: JSON.stringify({ path: spec.path, access: spec.access, role, results }),
          contentType: 'application/json',
        });
      });
    }
  });
}

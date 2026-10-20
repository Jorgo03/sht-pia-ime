import type { Page, Route } from '@playwright/test';

import { AGENT, CONVERSATIONS, LISTINGS, SAVED_SEARCHES, type Listing } from './fixtures';

// A stand-in for Supabase, served from inside the browser. The app under test
// is built against https://e2e.supabase.co, which does not exist, and every
// request to it is answered here, so a test can never read or write
// production data. Anything else off-site is blocked.

export const SUPABASE_HOST = 'e2e.supabase.co';

// Stand-in for listing photos, map tiles and storage objects.
const IMAGE = { status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#b49678"/></svg>' };

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };

const like = (needle: string) => needle.replace(/[*%]/g, '').toLowerCase();

function filter(rows: Listing[], params: URLSearchParams): Listing[] {
  let out = [...rows];
  for (const [column, expr] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(column)) continue;
    const dot = expr.indexOf('.');
    const op = expr.slice(0, dot);
    const value = expr.slice(dot + 1);
    const field = (r: Listing) => r[column];
    if (op === 'eq') out = out.filter((r) => String(field(r)) === value);
    if (op === 'in') {
      const ids = value.replace(/[()"]/g, '').split(',');
      out = out.filter((r) => ids.includes(String(field(r))));
    }
    if (op === 'ilike') out = out.filter((r) => String(field(r) ?? '').toLowerCase().includes(like(value)));
    if (op === 'gte') out = out.filter((r) => Number(field(r)) >= Number(value));
    if (op === 'lte') out = out.filter((r) => Number(field(r)) <= Number(value));
  }
  const order = params.get('order');
  if (order) {
    const [column, direction] = order.split('.');
    out.sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (direction === 'desc' ? -1 : 1));
  }
  return out;
}

function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({ status, contentType: 'application/json', headers: { ...CORS, ...headers }, body: JSON.stringify(body) });
}

async function properties(route: Route, url: URL, store: Listing[], writes: Write[]) {
  const req = route.request();
  const rows = filter(store, url.searchParams);
  if (req.method() === 'PATCH') {
    // An update changes this page's copy of the rows, so the app sees its own
    // edit on the next read. Tests read what was sent from `writes`.
    const body = req.postDataJSON() as Record<string, unknown>;
    writes.push({ table: 'properties', method: 'PATCH', query: url.search, body });
    for (const row of rows) Object.assign(row, body);
    return route.fulfill({ status: 204, headers: CORS, body: '' });
  }
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `*/${rows.length}` }, body: '' });

  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = url.searchParams.get('limit');
  const page = limit ? rows.slice(offset, offset + Number(limit)) : rows.slice(offset);
  if ((req.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
    return page[0] ? json(route, 200, page[0]) : json(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
  }
  const range = page.length ? `${offset}-${offset + page.length - 1}` : '*';
  return json(route, 200, page, { 'content-range': `${range}/${rows.length}` });
}

async function profiles(route: Route, url: URL) {
  const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
  const agent = LISTINGS.map((l) => l.agent).find((a) => a?.id === id);
  const row = agent ? { ...agent, role: 'agent' } : null;
  if ((route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
    return row ? json(route, 200, row) : json(route, 406, { code: 'PGRST116' });
  }
  return json(route, 200, row ? [row] : []);
}

/** A write the app sent to the fake backend. */
export type Write = { table: string; method: string; query: string; body: Record<string, unknown> };

/**
 * The signed-in user, when a test signs in: the fixtures' agent, who owns the
 * agent listings. The session goes into localStorage before the app starts,
 * where supabase-js looks for it, so no sign-in request is ever made.
 */
export const SIGNED_IN_USER = {
  id: AGENT.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'agent@example.com',
  user_metadata: { full_name: AGENT.full_name },
  app_metadata: { provider: 'email' },
  created_at: '2026-01-01T00:00:00Z',
};

const base64url = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function fakeSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 * 24;
  const accessToken = [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: SIGNED_IN_USER.id, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    'e2e-signature',
  ].join('.');
  return {
    access_token: accessToken,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: expiresAt,
    user: SIGNED_IN_USER,
  };
}

/** Where supabase-js keeps the session for https://e2e.supabase.co. */
export const SESSION_STORAGE_KEY = 'sb-e2e-auth-token';

export async function mockBackend(page: Page, { signedIn = false, writes = [] as Write[] } = {}) {
  // Each page edits its own copy, so one test's writes never leak into another.
  const store: Listing[] = LISTINGS.map((l) => ({ ...l }));

  // Realtime: accept the socket and stay silent, rather than letting the
  // client log a failed connection on every page.
  await page.routeWebSocket(/supabase\.co/, () => {});

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }

    if (url.hostname === SUPABASE_HOST) {
      if (url.pathname.startsWith('/storage/')) {
        if (method === 'GET' || method === 'HEAD') return route.fulfill(IMAGE);
        // Uploads and deletes are recorded as writes to "storage".
        let body: Record<string, unknown> = {};
        try { body = route.request().postDataJSON() ?? {}; } catch { /* binary upload */ }
        writes.push({ table: 'storage', method, query: url.pathname, body });
        return json(route, 200, method === 'DELETE' ? [] : { Key: url.pathname });
      }
      if (url.pathname.startsWith('/rest/v1/properties')) return properties(route, url, store, writes);
      if (url.pathname.startsWith('/rest/v1/profiles')) return profiles(route, url);
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/')[3];
        if (method !== 'GET' && method !== 'HEAD') {
          // Every other write (reports, blocks, activity…) is recorded and accepted.
          let body: Record<string, unknown> = {};
          try { body = route.request().postDataJSON() ?? {}; } catch { /* no body (DELETE) */ }
          writes.push({ table, method, query: url.search, body });
          return route.fulfill({ status: method === 'POST' ? 201 : 204, headers: CORS, body: '' });
        }
        if (table === 'conversations' && signedIn) return json(route, 200, CONVERSATIONS);
        if (table === 'saved_searches' && signedIn) return json(route, 200, SAVED_SEARCHES);
        return json(route, 200, []);
      }
      // Signed out: there is no session, and every sign-in attempt fails.
      if (url.pathname.startsWith('/auth/v1/user')) {
        return signedIn ? json(route, 200, SIGNED_IN_USER) : json(route, 401, { msg: 'no session' });
      }
      if (url.pathname.startsWith('/auth/v1/')) return json(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      // The AI and translation functions are "down": the app must degrade,
      // not break. Tests ignore console noise from these on purpose.
      if (url.pathname.startsWith('/functions/v1/')) return json(route, 503, { error: 'ai_unavailable' });
      return route.fulfill({ status: 404, headers: CORS, body: '' });
    }

    if (/unsplash\.com|tile\.openstreetmap|basemaps\.cartocdn/.test(url.hostname)) {
      return route.fulfill(IMAGE);
    }
    // index.html loads leaflet.css from unpkg with an integrity hash, so it has
    // to be the exact file; the installed package is the same version.
    if (url.hostname === 'unpkg.com' && url.pathname.endsWith('/leaflet.css')) {
      return route.fulfill({ status: 200, contentType: 'text/css', headers: CORS, path: 'node_modules/leaflet/dist/leaflet.css' });
    }
    // Web fonts: an empty stylesheet, so text renders in the fallback font.
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    // Anything else external is an unexpected dependency; blocking it makes
    // the console-error check flag it.
    return route.abort();
  });
}

/** Requests the mock fails on purpose; console errors about them are expected. */
export const isSimulatedFailure = (url: string) =>
  url.includes(`${SUPABASE_HOST}/functions/v1/`) || url.includes(`${SUPABASE_HOST}/auth/v1/`);

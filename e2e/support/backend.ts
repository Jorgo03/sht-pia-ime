import type { Page, Route } from '@playwright/test';

import { LISTINGS, type Listing } from './fixtures';

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

async function properties(route: Route, url: URL) {
  const req = route.request();
  const rows = filter(LISTINGS, url.searchParams);
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

export async function mockBackend(page: Page) {
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
      if (url.pathname.startsWith('/storage/')) return route.fulfill(IMAGE);
      if (url.pathname.startsWith('/rest/v1/properties')) return properties(route, url);
      if (url.pathname.startsWith('/rest/v1/profiles')) return profiles(route, url);
      if (url.pathname.startsWith('/rest/v1/')) return method === 'GET' ? json(route, 200, []) : route.fulfill({ status: 201, headers: CORS, body: '' });
      // Signed out: there is no session, and every sign-in attempt fails.
      if (url.pathname.startsWith('/auth/v1/user')) return json(route, 401, { msg: 'no session' });
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

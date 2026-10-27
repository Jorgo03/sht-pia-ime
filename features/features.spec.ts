import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { CDPSession, Page } from '@playwright/test';

import { SIGNED_IN_USER } from '/home/user/sht-pia-ime/e2e/support/backend';
import { test } from '/home/user/sht-pia-ime/e2e/support/test';
import { AGENT, CHAT_CLIENT_ID, CONVERSATIONS, LISTINGS, OWNER_LISTINGS } from '/home/user/sht-pia-ime/e2e/support/fixtures';

// Advert scenes, filmed from the real app build (dist-e2e-expo) against the
// fake backend. Only the sample content is staged: names, listings, chat.

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'feature-scenes');
const STAND = path.join(ROOT, 'stand');
fs.mkdirSync(OUT, { recursive: true });

Object.assign(AGENT, { full_name: 'Elira Kola', agency_name: 'Drita Prona', phone: '+355 69 123 4567' });
SIGNED_IN_USER.user_metadata.full_name = 'Elira Kola';
const SAMPLE = [
  { title: 'Apartament 2+1 në Bllok', price: 185000, beds: 2, baths: 2, sqft: 98, zone: 'Blloku' },
  { title: 'Vilë me pishinë në Sauk', price: 420000, beds: 4, baths: 3, sqft: 260, property_type: 'villa' },
  { title: 'Apartament 1+1 me qira', price: 650, beds: 1, baths: 1, sqft: 62, listing_type: 'rent' },
  { title: 'Apartament me pamje nga deti', city: 'Durrës', price: 139000, beds: 2, baths: 1, sqft: 85 },
  { title: 'Apartament 3+1 te Liqeni', price: 245000, beds: 3, baths: 2, sqft: 132 },
  { title: 'Penthouse me tarracë', price: 1400, beds: 3, baths: 2, sqft: 150, listing_type: 'rent' },
  { title: 'Shtëpi me oborr', city: 'Shkodër', price: 145000, beds: 3, baths: 2, sqft: 140, property_type: 'house' },
  { title: 'Apartament i ri në Kodër-Kamëz', price: 15_000_000, beds: 2, baths: 1, sqft: 80 },
];
LISTINGS.forEach((l, i) => Object.assign(l, {
  description: 'Apartament i ndritshëm, i rinovuar plotësisht, me ballkon dhe pamje të hapur. Afër shkollave, dyqaneve dhe transportit.',
  address: 'Rruga Ismail Qemali 12',
  features: ['balcony', 'elevator', 'parking', 'airConditioning'],
  ...SAMPLE[i],
}));

const CLIENT = { id: CHAT_CLIENT_ID, full_name: 'Arben Hoxha', agency_name: null, avatar_url: null, role: 'client' };
const CHAT = [
  { from: CHAT_CLIENT_ID, body: 'Përshëndetje! A është ende në shitje apartamenti në Bllok?' },
  { from: AGENT.id, body: 'Po, është i lirë. Mund ta shihni nesër në orën 17:00.' },
  { from: CHAT_CLIENT_ID, body: 'Shkëlqyeshëm, vij nesër. Faleminderit!' },
].map((m, i) => ({
  id: `e2e00000-0000-4000-f000-00000000000${i}`,
  conversation_id: CONVERSATIONS[0].id,
  sender_id: m.from,
  body: m.body,
  created_at: `2026-10-1${5 + i}T1${6 + i}:0${i}:00+01:00`,
  read_at: null,
}));

const manifest: Record<string, number> = fs.existsSync(path.join(OUT, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'))
  : {};

async function stage(page: Page, { favourites = false } = {}) {
  const cors = { 'access-control-allow-origin': '*' };
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  await page.route(/unsplash\.com|\/storage\/v1\/object\/public\/property-images\//, (route) => {
    const n = Number(/(?:photo-e2e-|photo-)(\d+)/.exec(route.request().url())?.[1] ?? 0);
    return route.fulfill({ path: path.join(STAND, `g${n % 8}.png`) });
  });
  await page.route(/tile\.openstreetmap|basemaps\.cartocdn/, (route) => route.fulfill({ path: path.join(STAND, 'tile.png') }));
  await page.route(/\/rest\/v1\/profiles/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const rows = [{ ...AGENT, role: 'agent' }, CLIENT];
    const id = new URL(route.request().url()).searchParams.get('id') ?? '';
    const pick = rows.filter((r) => id.includes(r.id));
    const accept = route.request().headers()['accept'] ?? '';
    return route.fulfill(json(accept.includes('vnd.pgrst.object') ? pick[0] ?? rows[0] : pick.length ? pick : rows));
  });
  await page.route(/\/rest\/v1\/messages/, (route) =>
    route.request().method() === 'GET' ? route.fulfill(json([...CHAT].reverse())) : route.fallback());
  const T: Record<string, [string, string]> = {
    en: ['2+1 apartment with balcony in Blloku', 'Bright, renovated, close to the park.'],
    it: ['Appartamento 2+1 con balcone a Blloku', 'Luminoso, ristrutturato, vicino al parco.'],
    de: ['2+1-Wohnung mit Balkon in Blloku', 'Hell, renoviert, nahe am Park.'],
    es: ['Apartamento 2+1 con balcón en Blloku', 'Luminoso, reformado, cerca del parque.'],
    pl: ['Mieszkanie 2+1 z balkonem w Blloku', 'Jasne, po remoncie, blisko parku.'],
    ru: ['Квартира 2+1 с балконом в Блоку', 'Светлая, с ремонтом, рядом с парком.'],
    fr: ['Appartement 2+1 avec balcon à Blloku', 'Lumineux, rénové, près du parc.'],
  };
  await page.route(/\/functions\/v1\/translate-property/, (route) => {
    const lang = (route.request().postDataJSON()?.targetLanguage ?? 'en') as string;
    const [title, description] = T[lang] ?? T.en;
    return route.fulfill(json({ title, description, provider: 'anthropic' }));
  });
  if (favourites) {
    await page.route(/\/rest\/v1\/favorites/, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(json([1, 3, 4].map((i) => ({ property_id: LISTINGS[i].id, properties: LISTINGS[i] }))))
        : route.fallback());
  }
  const head = (n: number) => ({ status: 200, headers: { ...cors, 'content-range': `0-${n - 1}/${n}` }, body: '' });
  const LEADS = [
    { name: 'Klajdi Brahimi', phone: '068 554 3321', email: null, notes: null, status: 'new' },
    { name: 'Sara Marku', phone: '+355 69 902 4417', email: 'sara@shembull.al', notes: 'Kërkon 2+1 në Tiranë deri 150.000 €, afër shkollës.', status: 'qualified' },
    { name: 'Marco Rossi', phone: '+39 333 000 1144', email: 'marco@esempio.it', notes: 'Diaspora, Itali. Vjen në dhjetor për të parë prona.', status: 'contacted' },
    { name: 'Ana Leka', phone: '+355 67 100 2030', email: 'ana@shembull.al', notes: 'Bleu apartamentin te Liqeni.', status: 'won' },
  ].map((l, i) => ({ ...l, id: `e2e00000-0000-4000-9000-00000000000${i}`, agent_id: AGENT.id, created_at: `2026-10-2${6 - i}T10:00:00+01:00` }));
  await page.route(/\/rest\/v1\/leads/, (route) => {
    const m = route.request().method();
    if (m === 'HEAD') return route.fulfill(head(LEADS.length));
    if (m === 'GET') return route.fulfill(json(LEADS));
    if (m === 'POST') return route.fulfill(json({ ...route.request().postDataJSON(), id: 'e2e00000-0000-4000-9000-0000000000aa', created_at: '2026-10-27T19:30:00+01:00' }));
    return route.fulfill({ status: 204, headers: cors, body: '' });
  });
  const prop = (l: (typeof LISTINGS)[number]) => ({ id: l.id, title: l.title, title_i18n: null, city: l.city ?? 'Tiranë', owner_id: l.owner_id, agent_id: l.agent_id });
  const VIEWINGS = [
    { id: 'e2e00000-0000-4000-8000-0000000000v1', property_id: LISTINGS[0].id, client_id: CHAT_CLIENT_ID, agent_id: AGENT.id, scheduled_at: '2026-10-27T20:30:00+01:00', status: 'confirmed', notes: 'Vij me bashkëshorten.', property: prop(LISTINGS[0]) },
    { id: 'e2e00000-0000-4000-8000-0000000000v2', property_id: LISTINGS[4].id, client_id: CHAT_CLIENT_ID, agent_id: AGENT.id, scheduled_at: '2026-10-28T11:30:00+01:00', status: 'requested', notes: null, property: prop(LISTINGS[4]) },
    { id: 'e2e00000-0000-4000-8000-0000000000v3', property_id: LISTINGS[1].id, client_id: CHAT_CLIENT_ID, agent_id: AGENT.id, scheduled_at: '2026-10-29T17:00:00+01:00', status: 'requested', notes: null, property: prop(LISTINGS[1]) },
  ];
  await page.route(/\/rest\/v1\/viewings/, (route) => {
    const m = route.request().method();
    if (m === 'HEAD') return route.fulfill(head(VIEWINGS.length));
    if (m === 'GET') return route.fulfill(json(VIEWINGS));
    return route.fulfill({ status: 204, headers: cors, body: '' });
  });
  await page.route(/\/rest\/v1\/wanted_homes/, (route) => route.request().method() === 'GET' ? route.fulfill(json([
    { id: 'e2e00000-0000-4000-8000-0000000000w1', client_id: CHAT_CLIENT_ID, city: 'Tirana', listing_type: 'sale', max_price: 250000, min_bedrooms: 2, notes: 'Familje me dy fëmijë, afër shkollës.', status: 'open', created_at: '2026-10-26T10:00:00+01:00' },
  ])) : route.fallback());
  const ACTIVITY = Array.from({ length: 63 }, (_, i) => ({ id: `e2e00000-0000-4000-7000-${String(i).padStart(12, '0')}`, type: i % 9 === 0 ? 'call' : i % 5 === 0 ? 'message' : i % 13 === 0 ? 'meeting' : 'view', created_at: new Date(Date.parse('2026-10-27T18:00:00+01:00') - (i % 28) * 86400000 - i * 3600000).toISOString() }));
  await page.route(/\/rest\/v1\/property_activity/, (route) => {
    const m = route.request().method();
    if (m === 'HEAD') return route.fulfill(head(ACTIVITY.length));
    if (m === 'GET') return route.fulfill(json(ACTIVITY));
    return route.fulfill({ status: 201, headers: cors, body: '' });
  });
  await page.route(/\/functions\/v1\/ai-listing-assistant/, (route) => route.fulfill(json({
    reply: 'Po. Apartamenti ka ballkon me pamje të hapur dhe parkim në garazhin e pallatit. Shkolla më e afërt është 5 minuta në këmbë.',
  })));
}

let started = 0;
const ready = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  return (Date.now() - started) / 1000;
};
const tap = async (page: Page, locator: ReturnType<Page['locator']>) => {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await page.waitForTimeout(150);
  await locator.click();
};
const scroll = async (page: Page, dy: number, steps = 30) => {
  await page.mouse.move(195, 500);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(16);
  }
};

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  timezoneId: 'Europe/Tirane',
  locale: 'sq-AL',
  allowConsoleErrors: [/.*/],
});

const FFMPEG = path.join(ROOT, 'tools/node_modules/ffmpeg-static/ffmpeg');
let cdp: CDPSession | null = null;
let frames: { file: string; t: number }[] = [];
let frameDir = '';

test.beforeEach(async ({ page }, info) => {
  const name = info.title.split(' ')[0];
  frameDir = path.join(OUT, `${name}-frames`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  frames = [];
  await page.clock.setFixedTime(new Date('2026-10-27T19:30:00+01:00'));
  cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', async (f: { data: string; sessionId: number; metadata: { timestamp: number } }) => {
    const file = path.join(frameDir, `${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp?.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
  started = Date.now();
});

test.afterEach(async ({ page }, info) => {
  const name = info.title.split(' ')[0];
  await page.waitForTimeout(300);
  await cdp?.send('Page.stopScreencast').catch(() => {});
  // Frames arrive only when the screen changes: hold each until the next.
  const t0 = frames[0]?.t ?? 0;
  const end = (Date.now() - started) / 1000;
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t - t0 : Math.max(end, f.t - t0 + 0.5);
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - (f.t - t0)).toFixed(3)}`);
  });
  if (frames.length) lines.push(`file '${frames[frames.length - 1].file}'`);
  const list = path.join(frameDir, 'list.txt');
  fs.writeFileSync(list, lines.join('\n'));
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', 'scale=1170:2532:force_original_aspect_ratio=decrease,pad=1170:2532:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', path.join(OUT, `${name}.mp4`)]);
  // Scene start relative to the first frame, for trimming in the edit.
  manifest[name] = Math.max(0, (manifest[name] ?? 0) - (t0 ? (t0 * 1000 - started) / 1000 : 0));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await page.close();
});

test.describe('signed in', () => {
  test.use({ signedIn: true });

  test('s01 home and matches', async ({ page }) => {
    await stage(page);
    await page.goto('/');
    manifest.s01 = await ready(page);
    await page.waitForTimeout(900);
    await scroll(page, 520, 40);
    await page.waitForTimeout(900);
    await scroll(page, 480, 40);
    await page.waitForTimeout(800);
  });

  test('s02 sale and rent', async ({ page }) => {
    await stage(page);
    await page.goto('/explore');
    manifest.s02 = await ready(page);
    await page.waitForTimeout(500);
    await tap(page, page.getByRole('button', { name: 'Shitje', exact: true }));
    await page.waitForTimeout(1200);
    await tap(page, page.getByRole('button', { name: 'Qira', exact: true }));
    await page.waitForTimeout(1200);
    await tap(page, page.getByRole('button', { name: 'Të gjitha', exact: true }));
    await page.waitForTimeout(1000);
  });

  test('s03 filters', async ({ page }) => {
    await stage(page);
    await page.goto('/explore');
    manifest.s03 = await ready(page);
    await tap(page, page.getByRole('button', { name: 'Filtrat' }));
    await page.waitForTimeout(1200);
    fs.writeFileSync(path.join(OUT, 's03.aria.txt'), await page.locator('body').ariaSnapshot());
    for (const name of ['Tiranë', 'Apartament', '2+']) {
      const b = page.getByRole('button', { name, exact: true }).last();
      if (await b.isVisible().catch(() => false)) { await tap(page, b); await page.waitForTimeout(600); }
    }
    await scroll(page, 300, 30);
    await page.waitForTimeout(1200);
  });

  test('s04 map', async ({ page }) => {
    await stage(page);
    await page.goto('/explore');
    manifest.s04 = await ready(page);
    await tap(page, page.getByRole('button', { name: 'Pamja e hartës' }));
    await page.waitForTimeout(2500);
    fs.writeFileSync(path.join(OUT, 's04.aria.txt'), await page.locator('body').ariaSnapshot());
    await page.waitForTimeout(1000);
  });

  test('s06 whatsapp and viewing', async ({ page }) => {
    await stage(page);
    await page.goto(`/property/${LISTINGS[4].id}`);
    manifest.s06 = await ready(page);
    fs.writeFileSync(path.join(OUT, 's06.aria.txt'), await page.locator('body').ariaSnapshot());
    await page.waitForTimeout(600);
    await scroll(page, 900, 40);
    await page.waitForTimeout(800);
    const viewing = page.getByRole('button', { name: /vizit/i }).first();
    if (await viewing.isVisible().catch(() => false)) await tap(page, viewing);
    await page.waitForTimeout(2000);
  });

  test('s07 favourites', async ({ page }) => {
    await stage(page, { favourites: true });
    await page.goto('/explore');
    manifest.s07 = await ready(page);
    await tap(page, page.getByRole('button', { name: 'Ruaj' }).first());
    await page.waitForTimeout(900);
    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1800);
  });

  test('s08 saved searches', async ({ page }) => {
    await stage(page);
    await page.goto('/saved-searches');
    manifest.s08 = await ready(page);
    await page.waitForTimeout(2600);
  });

  test('s09 messages', async ({ page }) => {
    await stage(page);
    await page.goto('/messages');
    manifest.s09 = await ready(page);
    await page.waitForTimeout(700);
    await tap(page, page.getByRole('button', { name: /Apartament 2\+1 në Bllok/ }).first());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    const box = page.getByRole('textbox').last();
    await tap(page, box);
    await box.pressSequentially('A mund ta shoh nesër në 17:00?', { delay: 45 });
    await page.waitForTimeout(1500);
  });

  test('s10 post a listing', async ({ page }) => {
    await stage(page);
    await page.goto('/listing/new');
    manifest.s10 = await ready(page);
    await tap(page, page.getByRole('button', { name: 'Shitje', exact: true }));
    await page.waitForTimeout(300);
    const title = page.getByRole('textbox', { name: /Apartament 2\+1 modern/ });
    await tap(page, title);
    await title.pressSequentially('Apartament 2+1 me ballkon në Bllok', { delay: 45 });
    await page.waitForTimeout(500);
    const desc = page.getByRole('textbox', { name: /Përshkruaj/ });
    await tap(page, desc);
    await desc.pressSequentially('I ndritshëm, i rinovuar, pranë parkut.', { delay: 35 });
    await page.waitForTimeout(500);
    for (const lang of ['EN', 'IT', 'DE']) {
      await tap(page, page.getByRole('button', { name: lang, exact: true }));
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(800);
  });

  test('s12 languages', async ({ page }) => {
    await stage(page);
    await page.goto('/');
    manifest.s12 = await ready(page);
    await tap(page, page.getByRole('button', { name: 'Gjuha' }));
    await page.waitForTimeout(1000);
    fs.writeFileSync(path.join(OUT, 's12.aria.txt'), await page.locator('body').ariaSnapshot());
    const it = page.getByText(/Italiano/).first();
    if (await it.isVisible().catch(() => false)) await tap(page, it);
    await page.waitForTimeout(1400);
    const lang = page.getByRole('button', { name: /Lingua|Language|Gjuha/ }).first();
    if (await lang.isVisible().catch(() => false)) {
      await tap(page, lang);
      await page.waitForTimeout(800);
      const en = page.getByText(/English/).first();
      if (await en.isVisible().catch(() => false)) await tap(page, en);
    }
    await page.waitForTimeout(1400);
  });

  test('s16 agent dashboard', async ({ page }) => {
    await stage(page);
    await page.goto('/agent-dashboard');
    manifest.s16 = await ready(page);
    await page.waitForTimeout(1200);
    await scroll(page, 420, 40);
    await page.waitForTimeout(900);
    const show = page.getByRole('button', { name: /Shfaq/ }).first();
    if (await show.isVisible().catch(() => false)) await tap(page, show);
    await page.waitForTimeout(1500);
  });

  test('s17 leads', async ({ page }) => {
    await stage(page);
    await page.goto('/leads');
    manifest.s17 = await ready(page);
    await page.waitForTimeout(1200);
    await tap(page, page.getByRole('button', { name: 'I kualifikuar', exact: true }).first());
    await page.waitForTimeout(1000);
    await tap(page, page.getByRole('button', { name: 'Të gjithë', exact: true }).first());
    await page.waitForTimeout(800);
    await tap(page, page.getByRole('button', { name: /Shto/ }).first());
    await page.waitForTimeout(900);
    const name = page.getByLabel('Emri').first();
    await tap(page, name);
    await name.pressSequentially('Erion Gjika', { delay: 50 });
    await page.waitForTimeout(1200);
  });

  test('s18 my listings', async ({ page }) => {
    await stage(page);
    await page.goto('/my-listings');
    manifest.s18 = await ready(page);
    await page.waitForTimeout(1200);
    await scroll(page, 500, 40);
    await page.waitForTimeout(1400);
  });

  test('s19 analytics', async ({ page }) => {
    await stage(page);
    await page.goto(`/listing/${LISTINGS[0].id}/analytics`);
    manifest.s19 = await ready(page);
    await page.waitForTimeout(1400);
    await scroll(page, 400, 40);
    await page.waitForTimeout(1400);
  });

  test('s20 viewings manage', async ({ page }) => {
    await stage(page);
    await page.goto('/viewings');
    manifest.s20 = await ready(page);
    await page.waitForTimeout(1200);
    const ok = page.getByRole('button', { name: /Konfirmo/ }).first();
    if (await ok.isVisible().catch(() => false)) await tap(page, ok);
    await page.waitForTimeout(1800);
  });

  test('s21 viewing request', async ({ page }) => {
    await stage(page);
    await page.goto(`/property/${OWNER_LISTINGS[0].id}`);
    manifest.s21 = await ready(page);
    await page.waitForTimeout(500);
    await scroll(page, 1400, 40);
    await page.waitForTimeout(600);
    await tap(page, page.getByRole('button', { name: 'Planifiko një vizitë' }));
    await page.waitForTimeout(900);
    const when = page.getByLabel('Kur?');
    await tap(page, when);
    await when.fill('2026-10-30T17:00');
    await page.waitForTimeout(600);
    const notes = page.getByRole('textbox', { name: /Shënime/ }).last();
    await tap(page, notes);
    await notes.pressSequentially('Vij pas punës.', { delay: 50 });
    await page.waitForTimeout(1200);
  });

  test('s22 notifications', async ({ page }) => {
    await stage(page);
    await page.goto('/profile');
    manifest.s22 = await ready(page);
    await page.waitForTimeout(700);
    await tap(page, page.getByRole('button', { name: 'Njoftimet' }).first());
    await page.waitForTimeout(2200);
  });

  test('s23 agent profile', async ({ page }) => {
    await stage(page);
    await page.goto(`/agent/${AGENT.id}`);
    manifest.s23 = await ready(page);
    await page.waitForTimeout(1000);
    await scroll(page, 500, 40);
    await page.waitForTimeout(1200);
  });

  test('s13 dark mode', async ({ page }) => {
    await stage(page);
    await page.goto('/');
    manifest.s13 = await ready(page);
    await page.waitForTimeout(600);
    await tap(page, page.getByRole('switch', { name: 'Ndrysho temën' }));
    await page.waitForTimeout(1200);
    await scroll(page, 500, 40);
    await page.waitForTimeout(1200);
  });
});

test.describe('signed out', () => {
  test('s05 listing with photos', async ({ page }) => {
    await stage(page);
    await page.goto(`/property/${LISTINGS[1].id}`);
    manifest.s05 = await ready(page);
    await page.waitForTimeout(800);
    await scroll(page, 450, 40);
    await page.waitForTimeout(900);
    await scroll(page, 450, 40);
    await page.waitForTimeout(900);
  });

  test('s15 search', async ({ page }) => {
    await stage(page);
    await page.goto('/explore');
    manifest.s15 = await ready(page);
    const box = page.getByRole('textbox').first();
    await tap(page, box);
    await box.pressSequentially('Durrës', { delay: 90 });
    await page.waitForTimeout(1800);
  });

  test('s24 sign in', async ({ page }) => {
    await stage(page);
    await page.goto('/profile');
    manifest.s24 = await ready(page);
    await page.waitForTimeout(600);
    await tap(page, page.getByRole('button', { name: /Agjent/ }).first());
    await page.waitForTimeout(800);
    await tap(page, page.getByRole('button', { name: /Klient/ }).first());
    await page.waitForTimeout(500);
    const email = page.getByLabel('Email', { exact: true });
    await tap(page, email);
    await email.pressSequentially('arben@shembull.al', { delay: 45 });
    await page.waitForTimeout(1200);
  });

  test('s11 ai assistant', async ({ page }) => {
    await stage(page);
    await page.goto(`/property/${LISTINGS[0].id}`);
    manifest.s11 = await ready(page);
    await tap(page, page.getByRole('button', { name: 'Asistenti i shpalljes' }));
    await page.waitForTimeout(1000);
    fs.writeFileSync(path.join(OUT, 's11.aria.txt'), await page.locator('body').ariaSnapshot());
    const box = page.getByRole('textbox').last();
    await tap(page, box);
    await box.pressSequentially('A ka parkim dhe ballkon?', { delay: 45 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
  });
});

test.describe('brand', () => {
  test('s14 door', async ({ page }) => {
    const L = await import('/home/user/sht-pia-ime/src/features/brand/doorLogo.js');
    const BOX = 600;
    const k = BOX / 200;
    const hinge = L.toSplashBox(L.HINGE, BOX);
    const T = L.TIMELINE;
    const place = `translate(${L.SPLASH.x} ${L.SPLASH.y}) scale(${L.SPLASH.scale})`;
    const svg = (inner: string, defs = '') =>
      `<svg width="${BOX}" height="${BOX}" viewBox="0 0 1024 1024"><defs>${defs}</defs><g transform="${place}">${inner}</g></svg>`;
    const font = '/home/user/sht-pia-ime/node_modules/@expo-google-fonts/newsreader/500Medium/Newsreader_500Medium.ttf';
    await page.route('https://door.local/**', (route) =>
      route.request().url().endsWith('.ttf') ? route.fulfill({ path: font }) : route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: News; src: url(https://door.local/news.ttf); font-weight: 500; }
html,body { margin:0; height:100%; background:#FFFFFF; }
.stage { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.box { position:relative; width:${BOX}px; height:${BOX}px; animation: enter ${T.end - T.enterStart}ms ${T.enterStart}ms cubic-bezier(.45,0,.55,1) forwards; }
.layer { position:absolute; inset:0; }
.glow { opacity:0; animation: glow ${T.end - T.doorStart - 300}ms ${T.doorStart + 50}ms cubic-bezier(.33,1,.68,1) forwards; }
.room { opacity:0; animation: room ${T.end - T.doorStart - 300}ms ${T.doorStart + 50}ms cubic-bezier(.33,1,.68,1) forwards; }
.bloom { opacity:0; animation: bloom ${T.end - T.enterStart}ms ${T.enterStart}ms cubic-bezier(.45,0,.55,1) forwards; }
.door { transform-origin:${hinge.x}px ${hinge.y}px; transform: perspective(${260 * k}px) rotateY(0deg);
  animation: door ${T.doorEnd - T.doorStart}ms ${T.doorStart}ms cubic-bezier(.42,0,.2,1) forwards; }
.word { margin-top: -60px; font: 500 58px News, serif; color:#FF5F1F; letter-spacing:-0.5px; opacity:0;
  animation: word 600ms 1900ms cubic-bezier(.2,.7,.3,1) forwards; }
@keyframes door { to { transform: perspective(${260 * k}px) rotateY(${L.DOOR_OPEN_DEG}deg); } }
@keyframes glow { to { opacity:.85; } }
@keyframes room { to { opacity:1; } }
@keyframes bloom { to { opacity:.5; } }
@keyframes enter { to { transform: scale(1.1); } }
@keyframes word { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
</style></head><body><div class="stage"><div class="box">
<div class="layer glow">${svg('<circle cx="128" cy="160" r="118" fill="url(#g)"/>',
  '<radialGradient id="g" cx="128" cy="160" r="118" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFC46B" stop-opacity=".45"/><stop offset=".55" stop-color="#FFB45E" stop-opacity=".16"/><stop offset="1" stop-color="#FFB45E" stop-opacity="0"/></radialGradient>')}</div>
<div class="layer room">${svg(`<g clip-path="url(#c)">
<rect x="72" y="43" width="112" height="188" fill="url(#w)"/><path d="M72,206L184,198V231H72Z" fill="url(#f)"/>
<rect x="86" y="112" width="34" height="46" rx="3" fill="#FFF9F0"/>
<line x1="103" y1="112" x2="103" y2="158" stroke="#F1CC9C" stroke-width="1.5"/><line x1="86" y1="135" x2="120" y2="135" stroke="#F1CC9C" stroke-width="1.5"/>
<rect x="80" y="173" width="40" height="13" rx="5" fill="#E39158" opacity=".4"/><rect x="78" y="183" width="44" height="16" rx="6" fill="#E39158" opacity=".55"/>
<line x1="153" y1="43" x2="153" y2="95" stroke="#D98B4F" stroke-width="1.2" opacity=".7"/><path d="M145,103A8,8 0 0 1 161,103Z" fill="#D98B4F" opacity=".85"/>
<circle cx="153" cy="106" r="42" fill="url(#l)"/></g>`,
  `<clipPath id="c"><path d="${L.DOORWAY}"/></clipPath>
<linearGradient id="w" x1="0" y1="43" x2="0" y2="231" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF4E3"/><stop offset="1" stop-color="#FFDDB0"/></linearGradient>
<linearGradient id="f" x1="0" y1="198" x2="0" y2="231" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F4C28C"/><stop offset="1" stop-color="#E6A266"/></linearGradient>
<radialGradient id="l" cx="153" cy="106" r="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".4" stop-color="#FFE6B3" stop-opacity=".55"/><stop offset="1" stop-color="#FFE6B3" stop-opacity="0"/></radialGradient>`)}</div>
<div class="layer bloom">${svg(`<path d="${L.DOORWAY}" fill="#FFF8EC"/>`)}</div>
<div class="layer">${svg(`<path d="${L.ARCH}" fill="${L.DOOR_COLOR}"/>`)}</div>
<div class="layer door">${svg(`<path d="${L.DOOR + L.KNOB}" fill="${L.DOOR_COLOR}" fill-rule="evenodd"/>`)}</div>
</div><div class="word">Shtëpia.ime</div></div></body></html>` }));
    await page.goto('about:blank');
    manifest.s14 = (Date.now() - started) / 1000;
    await page.goto('https://door.local/');
    await page.waitForTimeout(3600);
  });
});

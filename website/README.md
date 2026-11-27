# website/

The Shtëpia.ime website, started again on 2026-11-24 (DECISIONS.md W10) and
built on 2026-11-26 (W11). A separate project from the phone apps: its own
Vite + React app, reading the same Supabase project (`xzzzhlwmzotibrxdqmcm`)
with the public anon key and the same accounts.

## Pages

- `/`: hero with search, latest homes, browse by city, agents and agencies,
  get the app.
- `/search`: results for the search fields (`?deal=sale|rent&city=&type=&beds=&area=&max=&sort=`),
  24 at a time with "Load more".
- `/property/<id>`: photos, facts, description, features, contact (call,
  WhatsApp, email). Also where the phone app's shared links land.
- `/login`, `/signup`, `/forgot-password`, `/account`: sign-in on the same
  accounts as the phone app, and drawn like it (W13): `website/src/auth/AuthScreen.jsx`
  is the app's signed-out Profile screen (`app/(tabs)/profile.tsx`) for the web,
  with the dusk sky and skyline, the three-line headline, the glass card, the
  Client/Agent switch (an agent's Office Name is required, as in the app),
  Google, LinkedIn and Email code, the emailed 6-digit codes and the password
  reset, with the app's values and wording. Change the two together.
- `/privacy`, `/terms`, `/cookies`: static pages written by the build.
- Written by the build for search engines and link previews
  (`scripts/website/seo.mjs`, tested in `tests/websiteSeo.test.mjs`): each
  public page's own title, one `property/<id>.html` per live listing with its
  title, text and first photo (new listings use the shared page until the
  next deploy), `noindex` on sign-in and signed-in pages, `404.html`,
  `robots.txt` and `sitemap.xml`. The site address is `SITE_URL`, else
  Vercel's production domain; a local build without one skips the listing
  pages and the sitemap.

## How it fits together

- Search, filters, places, prices and agent lists reuse the app's shared code
  in `src/features/properties/lib/` and `src/lib/format.js`, so the website
  and the app return the same homes for the same search.
- Text comes from the shared locale files (`src/i18n/locales/*.json`, all 10
  languages); the website's own strings are under `web.*`. Albanian is
  bundled, other languages load when chosen; the choice is kept in
  `localStorage` (`fho_lang`).
- Brand: the logo lockup from `assets/brand/`, white over photos (logo guide),
  door orange `#FF5F1F` with ink text on buttons, Newsreader + Manrope. Light
  and dark follow the visitor's system.
- Hero photo: AI-generated for this site (see `public/images/CREDITS.md`).

## Commands

- `npm run website:dev`: local server on http://localhost:5180 (reads
  `.env.local` at the repo root).
- `npm run website:build`: builds to `dist-website/` the same way Vercel
  builds `dist/` (`scripts/build-website.mjs`: Vite, then the app's icons and
  `/.well-known/` from `public/`, then the legal pages).

`/api/auth-relay` (root `api/`) is served by Vercel beside the site and hands
Google sign-in back to the phone app.

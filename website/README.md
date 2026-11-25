# website/

The Shtëpia.ime website, started again on 2026-11-24 (DECISIONS.md W10) and
built on 2026-11-26 (W11). A separate project from the phone apps: its own
Vite + React app, reading the same Supabase project (`xzzzhlwmzotibrxdqmcm`)
with the public anon key. No sign-in yet.

## Pages

- `/`: hero with search, latest homes, browse by city, agents and agencies,
  get the app.
- `/search`: results for the search fields (`?deal=sale|rent&city=&type=&beds=&area=&max=&sort=`),
  24 at a time with "Load more".
- `/property/<id>`: photos, facts, description, features, contact (call,
  WhatsApp, email). Also where the phone app's shared links land.
- `/privacy`, `/terms`, `/cookies`: static pages written by the build.

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

# website/

The Shtëpia.ime website, started again from an empty page on 2026-11-24
(DECISIONS.md W10). It is a separate project from the phone apps: the apps
stay in the Expo code at the repo root, and both use the same Supabase
backend (project `xzzzhlwmzotibrxdqmcm`).

## What is here now

- `index.html`: the home page, empty on purpose until the new design arrives.

## What the build adds (scripts/build-website.mjs)

The live address does a few jobs for the phone apps, so the build keeps them
even while the site is empty:

- `/privacy`, `/terms`, `/cookies`: the legal pages the apps link to (and the
  app stores require), generated from `src/features/legal/content/`, the same
  texts the apps show.
- `public/`: icons and `/.well-known/` (app links, once written).
- `/api/auth-relay` (root `api/`): hands Google sign-in back to the phone app.

Build locally: `node scripts/build-website.mjs` writes `dist/`.

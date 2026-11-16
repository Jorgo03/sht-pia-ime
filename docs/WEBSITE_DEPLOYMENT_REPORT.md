# Website deployment report

## Where

- URL: https://real-estate-app-hazel-seven.vercel.app
- Vercel project `real-estate-app` (team my-self-f307), production branch
  `master`; every push to master deploys.

## Build

- Root `vercel.json`: `framework: null`, `buildCommand: node scripts/vercel-build.mjs`,
  `outputDirectory: dist`, clean URLs, old-address redirects, dynamic-route
  rewrites, security headers, long caching for `/_expo/static` and `/assets`.
- `scripts/vercel-build.mjs`: `expo export -p web` into `dist`, then
  `scripts/expo-web-postbuild.mjs` (per-listing pages, head tags on public
  pages, sitemap, robots, 404).
- Production deployment of 902a2ed: READY; the live page serves the new
  bundle.

## Environment variables (names only)

- Used if set: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_LEGAL_CONTACT_EMAIL`.
- Fallback in use today: the project's existing `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` (production and preview).
- Never in the client: any service-role or Anthropic key.

## Auth redirects

- Website: `https://real-estate-app-hazel-seven.vercel.app/auth/callback`
  (already used by the old site; unchanged).
- Phone apps: `shtepia-ime://auth/callback`, and Expo Go through the same
  page's relay (`api/auth-relay.js`, `?rt=`).
- When a custom domain is added: add `https://<domain>/auth/callback` in
  Supabase → Authentication → URL Configuration, and set
  `EXPO_PUBLIC_SITE_URL` in Vercel.

## Verification (live, 2026-11-16)

- Status 200 on `/`, `/explore`, `/wanted`, `/guide`, `/cookies`, `/agents`,
  a listing page, `/profile`, `/messages`, `/agent-dashboard`, `/sitemap.xml`,
  `/robots.txt`; 404 on an unknown address.
- Browser at 1920, 1366 and 390: no page errors; property data loaded (200).

## Rollback

- Vercel → project → Deployments → promote the last deployment built from the
  Vite site (before f860ed7), or revert the root `vercel.json` and push to
  master. The Vite code in `src/` is kept for this.

# Website built from the Expo app (preview project)

A **separate** Vercel project that deploys the Expo app's web build, so it
can be compared with the current site before anything changes in production.
The existing project (the Vite site in `src/`, `vercel.json` at the repo
root) is not touched by any of this.

## Create the project (once, in the Vercel dashboard)

1. Add New → Project → import this GitHub repository again (a second
   project on the same repo is allowed).
2. **Root Directory:** `deploy/expo-web`. Leave "Include files outside the
   root directory" on (the default): the build runs from the repo root.
3. Framework preset: **Other**. Build, install and output settings come from
   `deploy/expo-web/vercel.json`; leave the overrides off.
4. **Environment variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | `https://xzzzhlwmzotibrxdqmcm.supabase.co` |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the project's public anon key (Supabase → Settings → API) |
   | `EXPO_PUBLIC_SITE_URL` | this project's own address, e.g. `https://shtepia-expo-web.vercel.app` |
   | `EXPO_PUBLIC_LEGAL_CONTACT_EMAIL` | optional, the contact address for /privacy and /terms |

   Do **not** set `EXPO_PUBLIC_CHECKOUT_ENABLED` (buying stays off). Never put
   a service-role key here: everything with `EXPO_PUBLIC_` ends up in the
   browser.
5. Supabase → Authentication → URL Configuration → add
   `https://<this project's address>/auth/callback` to the redirect URLs, so
   Google/Apple sign-in can return to the preview.
6. Deploy.

## What the build does

`npm run build:web-expo` (`expo export -p web`) writes a static page per
route, then `scripts/expo-web-postbuild.mjs`:
- moves font assets out of `assets/node_modules` (some hosts skip such
  folders);
- writes `property/<id>.html` for every active listing with its own title,
  description, image and canonical URL (public data, anon key, like any
  visitor); listings created after the build fall back to
  `property/[id].html` through the rewrite in `vercel.json`, and the next
  deploy gives them their own page;
- writes `sitemap.xml`, `robots.txt` and `404.html`.

`vercel.json` also redirects the old Vite addresses (`/search`,
`/new-listing`, `/my-listings/<id>/edit|dashboard`, `/messages?c=<id>`) to the
new ones, so links people already shared keep working after a switch.

## Switching production later (needs the owner's approval)

Not part of this preview. When approved: move the production domain to this
project in Vercel → Domains, update the Supabase redirect URLs and
`EXPO_PUBLIC_SITE_URL`, keep the old project for one rollback window, then
retire `src/`.

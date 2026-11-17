# App ↔ website parity report

2026-11-16, branch `web-parity`. The mobile app is the source of truth.

## Architecture (Phase 0)

One codebase. The website is the Expo app's web export (`expo export -p web`),
deployed by the root `vercel.json` (`scripts/vercel-build.mjs`) at
https://real-estate-app-hazel-seven.vercel.app (DECISIONS.md W1, W6). Every
screen, rule, query and string is the app's own; web-only files are `*.web.tsx`
variants. Native-only libraries and their web stand-ins: `react-native-maps` →
Leaflet (`components/map/leaflet/`), date/time pickers → `*.web.tsx` inputs,
push notifications → none (browser), Apple sign-in → web OAuth. The old Vite
site in `src/` is no longer deployed and was not used as a reference.

The website looks like a website by the owner's choice (DECISIONS.md W5): a
site header and footer instead of the bottom tab bar, a landing-page Home. The
app's identity (palette, fonts, cards, components) is unchanged.

## Feature table

Mobile and website share one file unless the Website column says otherwise.

| Feature | Mobile app (evidence) | Website (evidence) | Gap | Required action | Status |
|---|---|---|---|---|---|
| Branding | `components/ui/app-header.tsx` (wordmark), `assets/` | same + `components/web/site-header.tsx` | none | — | ✅ |
| Theme light/dark | `contexts/theme-context.tsx`, `constants/theme.ts` | same; toggle in header (menu on phones) | none | — | ✅ |
| Navigation | `app/(tabs)/_layout.tsx`, `components/liquid-tab-bar.tsx` | `components/web/site-header.tsx` (top bar; folded menu < 980px) | different by design (W5) | — | ✅ |
| Homepage | `app/(tabs)/index.tsx` | `app/(tabs)/index.web.tsx` → `components/web/website-home.tsx` | landing page by design (W5); same data | — | ✅ |
| Search and filters | `app/(tabs)/explore.tsx`, `components/property/filter-sheet.tsx` | same; desktop filter sidebar (`FilterSidebar`) | none | — | ✅ |
| Locations | `src/features/properties/data/locations.js` (generated), `lib/places.js` | same | Plazh, Currila were absent | added (DECISIONS.md W8), live table too | ✅ |
| City order | `orderCities` in `lib/places.js` | same | was alphabetical | fixed: Tirana, Durrës, rest | ✅ |
| Rental price rule | `pricePerM2` in `src/features/properties/lib/compare.js` | same | detail and row had own copies | fixed: one rule, tested | ✅ |
| Property cards | `components/property/property-card.tsx`, `property-row.tsx` | same | none | — | ✅ |
| Property details | `app/property/[id].tsx` | same; desktop two columns; pre-rendered page per listing with meta tags | none | — | ✅ |
| Publish / edit listing | `app/listing/new.tsx`, `app/listing/[id]/edit.tsx` | same; web file inputs | none | — | ✅ |
| Auth | `contexts/auth-context.tsx`, Profile tab | same; web OAuth via `/auth/callback` | none | — | ✅ |
| Own profile | `app/(tabs)/profile.tsx` | same | none | — | ✅ |
| Public profile | `app/user/[id].tsx` (RPC `public_profile`) | same | none | — | ✅ |
| Agent profile | `app/agent/[id].tsx`, `app/agents` | same | none | — | ✅ |
| Messaging | `app/(tabs)/messages.tsx`, `app/messages/[id].tsx` (realtime) | same tables and channels | none | — | ✅ |
| Favourites | `contexts/favorites-context.tsx` (`favorites` table) | same | none | — | ✅ |
| Notifications | `app/notifications.tsx`, `contexts/notifications-context.tsx` | same centre and badge | no push in browsers | — | ✅ (push: remaining difference) |
| Maps | `components/map/map-canvas.native.tsx` | `map-canvas.web.tsx` (Leaflet), same interface | none | — | ✅ |
| Client dashboard | Profile, Favourites, Saved searches, Viewings | same | none | — | ✅ |
| Agent dashboard | `app/agent-dashboard/index.tsx` | same | shown to clients | fixed: agents-only notice | ✅ |
| Agent private reports | `app/performance/index.tsx`, RPC `my_performance_report` (auth.uid only) | same | — | proven by `supabase/tests/agent_report_privacy.sql` | ✅ |
| Language switching | `i18n/index.ts`, 10 languages | same + `?lang=` links (hreflang) | el, tr machine-translated | human review | ✅ |
| Empty / error / loading | rule in CLAUDE.md, per screen | same | none | — | ✅ |
| Currency, price history | `contexts/currency-context.tsx`, `components/property/price-history.tsx` | same | none | — | ✅ |

## Measured website problems (live site, before this branch)

Measured with Playwright at 1920, 1600, 1440, 1366, 1024, 768, 430, 390, 375
and 360 px on `/`, `/explore`, `/profile`:

| Problem | Measured | Result |
|---|---|---|
| Horizontal overflow | none at any width | ✅ |
| Narrow content container | public pages 1280px wide (was a 480px phone column before W5) | ✅ |
| Empty space on the right | 320px each side at 1920 (43 at 1366); the wheel did nothing there | fixed: wheel in the margins scrolls the page (`lib/web/forward-wheel.js`) |
| Internal scrollbar instead of page scroll | every page scrolls inside a container, not the document | remaining difference (React Native for web); scrollbar visible, margins now scroll |
| Footer alignment | footer inside the 1280 column, left-aligned with the content | ✅ |

## Unknowns

- Visual comparison with the running phone app: no simulator or device in this
  environment, so screens were compared through the shared code and tokens,
  not side-by-side screenshots.
- Supabase Auth redirect allow-list: not readable through the tools here; the
  production address was already in use by the old site's `/auth/callback`.

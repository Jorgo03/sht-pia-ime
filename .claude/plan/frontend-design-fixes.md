# Frontend design fixes: website and app (targeted, 2026-11-28)

Owner chose "targeted fixes": keep the current look, fix what is broken or weak.

## Website (website/)
1. Listing page, phone: price block (deal pill, price, price/m²) under the title;
   a sticky bottom bar with Call / WhatsApp that stays on screen.
2. Listing page, desktop: contact card sticky beside the content; message box
   tall enough for the default text; facts grid without an orphan row.
3. Home: city tiles only for cities with listings (as the app, rankCityTiles);
   latest listings 4 columns on wide screens; agents section shows only the
   "Are you an agent?" card when there are no agents.
4. Search results: 4 columns on wide screens (no orphans at 4 / 8 results).
5. Wanted: list of posts with an empty message; same column as other pages.

## App (Expo)
6. Design review of the main screens' code against constants/theme.ts and
   design-system/MASTER.md; fix the confirmed issues.

## Verify
Website e2e suite (npm run test:e2e:website), lint, tsc, unit tests, website
build; screenshots before/after at 390 / 768 / 1440; push, verify live.

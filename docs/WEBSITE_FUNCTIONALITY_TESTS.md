# Website: functionality tests

2026-11-17. All browser tests run against the website built from the Expo app
(`npm run test:e2e:expo`), phone and desktop Chromium, with a fake backend in
the browser (`e2e/support/backend.ts`): no network, no real accounts, no
production data. Every test also fails on a page error, a console error or a
5xx. Results of the last runs are in "Results" below; nothing here is
claimed without a run.

## What is covered, by area

| Area | Tests (`e2e-expo/`) |
|---|---|
| Every route, every role, 10 sizes, access by address | `site-audit.spec.ts` (93 cases) |
| Routes, menu, header, footer, 404, old-address redirects | flows X09, X10, X11, X76 |
| Sign in, sign up, email codes, password reset, change password | flows X03, X17, X18, X27, X30–X32, X56–X62, X87–X92; `start-screen.spec.ts` |
| Roles: agent vs client | flows X61, X66, X69, X78–X80; audit (client sees "for agents") |
| Search and filters (sale/rent, city, neighbourhood, amenities, near me, sort, save search) | flows X02, X35, X38, X94, X98, X100, X101, X108 |
| Favourites | flows X04, X29, X105 |
| Listing page (gallery, video, full-screen photo, price per m² never on rentals) | flows X37, X48, X77, X99 |
| Viewings | flows X42, X54, X71, X104 |
| Publishing, drafts, photo upload, edit, delete, sold, CSV import | flows X20–X23, X53, X70, X102 |
| Wanted homes, saved searches | flows X74, X101; audit (board, signed-out post goes to sign in) |
| Messaging (send, refused send, photos, report, block) | flows X06, X49, X55, X63, X73; `chat.spec.ts` |
| Notifications (bell, mark read, live banner, deep links, empty, retry) | flows X81–X84, X93 |
| Agent dashboard, leads, private report | flows X39–X41, X66–X68 |
| Agencies directory, compare, public profile | flows X95–X97; `public-profile.spec.ts` |
| Language, themes, reduced motion, offline | flows X07, X64, X86, X106 |
| Accessibility (axe) | `a11y.spec.ts` |

Database privacy is tested separately in SQL:
`supabase/tests/agent_report_privacy.sql`.

## Results

- Unit tests (`npm test`): 632 of 632 passed.
- Type check (`npx tsc --noEmit`): 0 errors. Lint: 0 errors, 36 warnings.
- Site audit: 93 of 93 passed.
- Full Expo website suite: see `WEBSITE_DEPLOYMENT_REPORT.md` for the run
  that preceded the deploy.

## Not tested

- Real payments (none exist; pricing page is information only).
- Google / Apple / LinkedIn sign-in end to end (needs real providers); the
  callback page itself is tested live (200).
- `/moderation` (no moderator test account; code read).

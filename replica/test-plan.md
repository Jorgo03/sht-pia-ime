# Test plan: Shtëpia.ime

Build tested: c36fb99, re-tested on ae5a93e+  Date: 2026-10-14

Environment:
- Web: Vite production build. Phone app: `expo export -p web`.
- Both were served locally against a replayed copy of the 15 real production
  listings, using Chromium (Playwright) with axe-core. Viewports were 375 and
  390px with touch enabled, plus 1280px desktop.
- RLS was tested live on `xzzzhlwmzotibrxdqmcm`, inside transactions that were
  rolled back, as anon, Klient and Agjent.
- The payments schema was tested in PGlite (in-process Postgres).

## Automated: `npm run test:e2e`

Since c64b1e2 the cases marked **e2e** below are Playwright specs in `e2e/`.
That is 36 tests, run on a phone (Pixel 7) and on desktop Chrome, so 72 runs.
The phone-only sideways-scroll check is skipped on desktop.

- The site is built against a fake Supabase host, and `e2e/support/backend.ts`
  answers every call inside the browser. The suite runs offline and can never
  touch production.
- The listings are made up (`e2e/support/fixtures.ts`), so no real person's
  phone number is in the repo. The owner phones use the formats that broke
  before (`069…`, `+ 069…`, `+39…`).
- Every test fails on a page error, a console error or an HTTP 5xx. Calls the
  mock fails on purpose (AI functions down, sign-in rejected) are exempt.
- `e2e/a11y.spec.ts` runs axe-core on 7 screens. Open bugs are listed by rule
  in `KNOWN`; remove a rule when its bug is fixed.
- Selectors use roles and labels, and expected text comes from the locale
  files (`e2e/support/i18n.ts`). A copy change therefore does not break a
  test, but a missing key does.
- Proof that the tests catch bugs: with the listing page from before the fixes
  (c36fb99), 8 of the 10 listing tests fail.

```bash
npm run test:e2e:install   # once per machine: downloads Chromium
npm run test:e2e           # report: npx playwright show-report
npx playwright test e2e/property.spec.ts --project=phone   # one file
```

## Cases

Result legend: **pass**, **fail → BUG-xxx (fixed/open)**, **not run** (with
the reason).

| case | flow | type | steps | expected | how | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | browse | happy | open `/` | listings, sections and images load | e2e | pass |
| F01-H2 | search | happy | open `/search` | all 15 listings and the count shown | e2e | pass |
| F01-E1 | search | edge: AI search down (Edge Function 503) | type "Durrës", Enter | falls back to text search, no crash | e2e | pass |
| F01-E2 | all | edge: 375px mobile width | every route | no horizontal scroll | e2e | pass |
| F01-E3 | search | edge: accents | search "Durrës" | matches "Durres" listings | e2e | pass |
| F02-H1 | detail | happy | open an agent listing | gallery, price, features, map, agent | e2e | pass |
| F02-H2 | detail | happy: owner listing | open a listing with no agent | chat, call and WhatsApp offered | e2e | fail → BUG-001 (fixed) |
| F02-H3 | detail | happy | tap WhatsApp | `wa.me/<intl digits>` with a pre-filled message | e2e | fail → BUG-003 (fixed) |
| F02-H4 | detail | happy | tap Share (phone, desktop) | working link; confirmation on desktop | e2e + code | fail → BUG-002, BUG-010 (fixed) |
| F02-E4 | detail | edge: phone formats | `0692…`, `+ 069…`, `+39…`, `0039…` | right country code for call and WhatsApp | unit | fail → BUG-007, BUG-011 (fixed) |
| F02-N1 | detail | negative: deleted listing | open an unknown id | message plus a way on | e2e | fail → BUG-004 (fixed) |
| F03-N1 | favourites | negative: signed out | open `/favorites`; tap heart | sent to sign-in | e2e | pass |
| F04-N1 | auth | negative: protected routes signed out | `/messages`, `/favorites`, `/new-listing`, `/my-listings`, `/viewings`, `/saved-searches`, `/agent-dashboard` | redirect to `/profile` | e2e | pass |
| F04-N2 | auth | negative: wrong password | sign in with a bad password | error shown and announced, stays on `/profile` | e2e | fail → BUG-014 (fixed) |
| F04-H1 | auth | happy: Google sign-in | real Google OAuth | signed in, profile created | manual | not run: the sandbox cannot reach Google. Owner to click through |
| F04-E1 | auth | edge: role escalation | Klient updates own `role` to agent | rejected | live RLS | pass |
| F05-N1 | messages | negative: signed out | open Messages | prompt plus sign-in | e2e | web pass; phone app fail → BUG-005 (fixed) |
| F05-E1 | messages | edge: second user's data | read and write another user's conversation | invisible / rejected | live RLS | pass |
| F06-N1 | new listing | negative: signed out | open `/new-listing` | redirect | e2e | pass |
| F06-H1 | new listing | happy: create with photos | real upload to Storage | listing live with photos | manual | not run: needs a real account and Storage. Owner to click through |
| F06-E1 | new listing | edge: another user's listing | Klient updates or deletes someone else's property | rejected | live RLS | pass |
| F07-E1 | viewings | edge: second user's data | read other users' viewings | invisible | live RLS | pass |
| F08-H1 | settings | happy | switch to English, reload | English persists, `<html lang="en">` | e2e | fail → BUG-013 (fixed) |
| F08-H2 | settings | happy | toggle theme, reload | theme persists | e2e | pass |
| F09-H1 | legal | happy | `/privacy`, `/terms` in sq, en, de | renders; de shows the "English shown" note | e2e | pass |
| F10-E1 | data | edge: anon reads | anon selects profiles | only agent profiles, no private columns | live RLS | pass |
| F11-E1 | payments | edge: self-promotion | client sets `promoted_until` | rejected by trigger | PGlite + live | pass |
| F11-E2 | payments | edge: one live subscription per agent | insert a second active subscription | rejected | PGlite | pass |
| F11-N1 | payments | negative: card declined | real checkout | — | manual | not run: no payment provider chosen yet |
| A11Y-1 | all | accessibility | axe-core on every screen | no serious violations | e2e | fail → BUG-006 (partly fixed), BUG-008, BUG-009 (open), BUG-012 (fixed) |
| UNIT | — | — | `npm test` | all green | unit | pass (127/127) |

## Totals

- 31 cases: 28 run, 3 not run. Google sign-in, real photo upload and card
  payment are manual or owner items.
- Of the 28 run, 19 passed first time and 9 failed. 8 of those failures are
  now fixed and re-tested green. The accessibility case is only partly fixed:
  cards, contrast and phone-app image alt text are still open.
- 14 bugs in total: 11 fixed, 1 partly fixed (BUG-006), 2 open (BUG-008,
  BUG-009). There are no S1 bugs.

## Manual checklist for the owner (on a real phone, against production)

1. Sign in with Google and confirm the consent screen and that you land
   signed in.
2. Create a listing with 3 photos as a Klient account. It should appear on
   Home within a few seconds.
3. Open that listing from another account and tap Call, WhatsApp and Share.
   Call should dial `+355…`, WhatsApp should open the chat with the message
   pre-filled, and the shared link should open the website.
4. Open a deleted listing's link. You should see the "no longer available"
   screen with Search and Home buttons.
5. Sign out, open Messages and tap "Sign in". You should land on Profile.

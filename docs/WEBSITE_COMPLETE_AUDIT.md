# Website: complete audit

2026-11-17. Site: https://real-estate-app-hazel-seven.vercel.app (Expo web
build, DECISIONS.md W6). Every route in `docs/WEBSITE_ALL_LINKS_INVENTORY.md`
was opened as a **visitor**, a **client** and an **agent** by
`e2e-expo/site-audit.spec.ts` against the offline fake backend (test data
only, never production data). Result of the last run: **93 of 93 passed**
(31 routes × 3 roles; public pages at all 10 sizes, private pages at 6).

Each visit fails on: a page error, a console error, a 5xx, a blank page, a
page wider than the window, a control off screen, a broken image, a
stretched photo, or a private page shown to someone not allowed to see it.

## Per page

| Page | URL | Purpose | Changes in this audit | Result |
|---|---|---|---|---|
| Home | `/` | Landing page | Hero photo loads eagerly (was lazy, blank at first paint) | ✅ all sizes |
| Explore | `/explore` | Search: filters, grid, sort, map | — (desktop sidebar, 3-column grid already in place) | ✅ |
| Wanted homes | `/wanted` | Board for agents, explainer + post form for others | — | ✅ |
| Agencies | `/agents` | Directory | 3-column grid on desktop (was one stretched column) | ✅ |
| Agent profile | `/agent/<id>` | Public agent page | — | ✅ |
| Public profile | `/user/<id>` | Lister's public page | Added to the sitemap | ✅ |
| Listing | `/property/<id>` | Gallery, facts, contact | Gallery 420–640px tall on desktop (was 288px) | ✅ |
| Compare | `/compare` | Side-by-side | — | ✅ |
| Guide, legal | `/guide`, `/privacy`, `/terms`, `/cookies` | Content | Footer drawn full width (was cramped in the text column) | ✅ |
| Pricing | `/pricing` | Plans (web only) | — | ✅ |
| Sign in | `/profile` | Sign in / account | — | ✅ |
| 404 | any unknown address | Not found | — | ✅ real 404 status |
| Messages | `/messages` | Conversations | Desktop: list on the left, "choose a conversation" on the right | ✅ |
| Chat | `/messages/<id>` | One conversation | Desktop: list beside the chat, active row marked | ✅ |
| Favourites | `/favorites` | Saved homes | Visitor now asked to sign in (saw an empty list) | ✅ |
| Saved searches | `/saved-searches` | Searches, wanted requests | Visitor now asked to sign in | ✅ |
| Viewings | `/viewings` | Viewing requests | Visitor now asked to sign in | ✅ |
| Notifications | `/notifications` | Notification centre | — | ✅ |
| My listings | `/my-listings` | Agent/owner listings | Visitor now asked to sign in | ✅ |
| Publish | `/listing/new` | Wizard | — | ✅ |
| Blocked users | `/blocked-users` | Blocks | — | ✅ |
| Agent dashboard | `/agent-dashboard` | Agent home | Wide (up to 1080px) with a 4-across stat row on desktop | ✅ |
| Leads | `/leads` | CRM | — | ✅ client sees "for agents" |
| Performance | `/performance` | Private report | — | ✅ client sees "for agents"; DB returns own rows only |
| CSV import | `/listing/import` | Bulk import | — | ✅ client sees "for agents" |
| Edit listing | `/listing/<id>/edit` | Edit | — | ✅ |
| Listing statistics | `/listing/<id>/analytics` | Per-listing stats | Visitor now asked to sign in (saw a zero dashboard) | ✅ |

## Privacy and access

- By address: every private page asks a visitor to sign in; agent tools tell a
  client they are for agents (checked by the audit test, every size).
- In the database: the performance report and messages are protected by RLS,
  proven with `supabase/tests/agent_report_privacy.sql` (another agent reads
  zero rows). Public profiles select no private columns.
- Search engines: private pages carry `noindex, nofollow` and are blocked in
  `robots.txt`; public pages, listings and lister profiles are in
  `sitemap.xml`.

## Prices

Rentals never show a price per m²: one shared helper (`pricePerM2`) returns
nothing for rentals, used by the listing page and the cards (unit tested).

## Remaining issues (not fixed here)

- On Explore at desktop width the page title and search box sit centred
  above the results while the filters sit on the left; it reads fine but
  the title does not line up with the grid.
- Notifications, Saved searches, Viewings, Favourites, Blocked users and the
  publish wizard stay in the 720px app column on desktop (W5's rule for app
  screens). They are short lists and forms, so this is intentional.
- `/moderation` was checked by reading code only: there is no moderator test
  account.
- Image sharpness of real listing photos depends on what agents upload; the
  test fixtures are 64×64 placeholders, so "low resolution" flags in the
  audit data are about the fixtures, not the site. Live photos checked by
  hand were sharp.

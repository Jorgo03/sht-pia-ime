# Website: every route and link

2026-11-17. Site: https://real-estate-app-hazel-seven.vercel.app (the Expo
app's web build, DECISIONS.md W6). Found from the route files (`app/`), every
`router.push/replace`, `href` and `to:` in the code, the live `sitemap.xml`
and `robots.txt`, and a browser crawl of every route as a visitor, a client
and an agent (`e2e-expo/site-audit.spec.ts`).

Status: ✅ opens the right page, no page errors, no overflow at the brief's 10
sizes, correct access rule. "Signed in" = asks a visitor to sign in.
"Agents" = tells a client it is for agents. Results per page are in
`WEBSITE_COMPLETE_AUDIT.md`.

There is no admin area beyond `/moderation`, which is web-only and for
moderators (`is_moderator()`); no admin test account exists, so it was
checked by reading the code.

## Public

| Link | Destination | Page type | Status | Action |
|---|---|---|---|---|
| Header logo, menu "Home" | `/` | Landing page | ✅ | Redesigned (W9) |
| Menu "Search", Home search, "Search homes", footer | `/explore` | Search: list, map, filters | ✅ | Desktop sidebar |
| City tiles, Home search box | `/explore` with city filter | Search | ✅ | — |
| Menu "Wanted homes", Home card, footer | `/wanted` | Wanted-homes board | ✅ | Full-width footer (peer, e6dfb58) |
| Menu "Agencies", footer | `/agents` | Directory | ✅ | Grid on desktop |
| Agency row, Home agency strip | `/agent/<id>` | Public agent profile | ✅ | — |
| Chat header name, listing publisher | `/user/<id>` | Public profile | ✅ | Added to sitemap |
| Every property card | `/property/<id>` | Listing | ✅ | Bigger gallery on desktop |
| Listing "Compare", footer | `/compare` | Comparison | ✅ | — |
| Menu "Buying from abroad", Home card, footer | `/guide` | Guide | ✅ | Full-width footer |
| Footer, Profile | `/privacy`, `/terms`, `/cookies` | Legal | ✅ | Full-width footer |
| Footer | `/pricing` | Plans and prices (web only) | ✅ | — |
| Unknown address | 404 page | Not found | ✅ (real 404) | — |
| Old addresses `/search`, `/new-listing`, `/my-listings/<id>/edit`, `/my-listings/<id>/dashboard`, `/messages?c=<id>` | redirects (vercel.json) | Redirect | ✅ (X09) | — |

## Auth

| Link | Destination | Page type | Status | Action |
|---|---|---|---|---|
| Header "Sign in", every sign-in prompt | `/profile` | Sign in, sign up, email code, password recovery, Google | ✅ (X03, X17–X18, X27, X32, X56–X62, X87–X92) | — |
| Google / Apple / LinkedIn return | `/auth/callback` | OAuth callback (web) and relay to the app (`api/auth-relay.js`) | ✅ live: 200 | — |
| First screen on phones | `/profile?start=1` | Sign in | ✅ (S1–S4) | — |

## User account (signed in)

| Link | Destination | Page type | Status | Action |
|---|---|---|---|---|
| Header account, menu | `/profile` | Profile, settings, sign out, delete account, download my data | ✅ | — |
| Header bell | `/notifications` | Notification centre | ✅ Signed in | — |
| Profile menu | `/favorites` | Favourites | ✅ Signed in | Visitor saw an empty list: fixed |
| Profile menu | `/saved-searches` (`?tab=wanted&new=1`) | Saved searches, wanted requests | ✅ Signed in | Visitor saw a working form: fixed |
| Profile menu | `/viewings` | Viewings | ✅ Signed in | Visitor saw "no viewings": fixed |
| Profile menu | `/blocked-users` | Blocked users | ✅ Signed in | — |
| Header "List your home" | `/listing/new` | Publish (wizard) | ✅ Signed in | — |
| Profile menu | `/my-listings` | My listings | ✅ Signed in | Visitor saw an empty list: fixed |
| My listings | `/listing/<id>/edit` | Edit listing | ✅ Signed in | — |
| My listings | `/listing/<id>/analytics` | Listing statistics | ✅ Signed in | Visitor saw a zero dashboard: fixed |

## Agent account

| Link | Destination | Page type | Status | Action |
|---|---|---|---|---|
| Profile menu | `/agent-dashboard` | Dashboard | ✅ Agents | Wide on desktop |
| Dashboard | `/leads` | Leads (CRM) | ✅ Agents | — |
| Dashboard | `/performance` | Private performance report | ✅ Agents; database: own rows only (`supabase/tests/agent_report_privacy.sql`) | — |
| My listings | `/listing/import` | CSV import | ✅ Agents | — |

## Messaging and notifications

| Link | Destination | Page type | Status | Action |
|---|---|---|---|---|
| Header messages icon, menu | `/messages` | Conversations | ✅ Signed in | Two panes on desktop |
| Conversation row, listing "Chat", notification | `/messages/<id>` | Chat (photos, files, report, block) | ✅ Signed in | List beside chat on desktop |
| Notification rows | `/messages/<id>`, `/viewings`, `/property/<id>`, `/saved-searches`, `/my-listings` (`src/features/notifications/lib/feed.js`) | Deep links | ✅ (X82, wantedMatch tests) | — |

## Admin

| Link | Destination | Page type | Status | Action |
|---|---|---|---|---|
| (no menu link; moderators only) | `/moderation` | Reports queue (web only) | Code read: shows "for moderators only" to others; server checks `is_moderator()` | — |

## Legal and files

| Link | Destination | Status |
|---|---|---|
| `/sitemap.xml` | public pages, every active listing, lister profiles | ✅ |
| `/robots.txt` | blocks the signed-in pages | ✅ |
| Signed-in pages | `<meta name="robots" content="noindex, nofollow">` | Added |
| `/site.webmanifest`, `/favicon.svg`, `/apple-touch-icon.png` | ✅ |

## External (checked, not replaced)

| Link | Where | Status |
|---|---|---|
| `https://www.openstreetmap.org/copyright`, `https://leafletjs.com` | Map attribution | 200 |
| `https://wa.me/<phone>` | Listing "WhatsApp", leads | 200 |
| `https://www.google.com/maps` | Listing "Open in Google Maps" | 200 |
| `tel:`, `mailto:` | Listing call, agent phone, leads, legal contact | handled by the device |

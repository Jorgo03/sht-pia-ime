# Website from the Expo app: gap report

2026-11-16. Compares the owner's brief (`shtepia-ime-master-prompt.md`, kept
outside the repo) with what this repo already has. The brief is written for
an empty repo. Most of it exists already, so this report lists only what is
missing and what clashes with decisions already made.

Status: **waiting for the owner's answers on C1–C6** (bottom). Nothing has
been built yet.

Key: ✅ exists · 🟡 partly there · ❌ missing · ⚠️ conflicts with a decision

## 1. Ground rules (brief §0, §2, §7.3–7.4)

| Brief | Repo | |
|---|---|---|
| Website = `expo export --platform web` on Vercel, not a separate site | `npm run build:web-expo` + `scripts/expo-web-postbuild.mjs` + `deploy/expo-web/vercel.json` (SPA rewrites, caching, old-URL redirects) | ✅ |
| Expo, expo-router, TS strict | Expo SDK 58, expo-router typed routes, one `tsconfig.json` | ✅ |
| Theme tokens in `src/theme/` | `constants/theme.ts` (`src/` is the old Vite site) | ✅ keep where it is |
| TanStack Query + Zustand | TanStack Query yes; small state in React contexts (`contexts/`) | ✅ no Zustand needed |
| Maps: one interface, native + Leaflet | `components/map/map-canvas.native.tsx` / `.web.tsx` (Leaflet) | ✅ |
| Anthropic only via Edge Functions | Yes (`supabase/functions/`) | ✅ |
| ESLint, Prettier, unit tests, Playwright | ESLint, `tsc`, `npm test`, `e2e-expo/` (139 tests). No Prettier | ✅ (Prettier not worth a repo-wide reformat) |
| Env vars `EXPO_PUBLIC_SUPABASE_*` | Yes; documented in `deploy/expo-web/README.md` | ✅ |
| Free tier, `*.vercel.app` until the domain | Yes | ✅ |
| `docs/DEPLOY.md` with domain-switch steps | Steps are in `deploy/expo-web/README.md` | 🟡 move/link only |
| Preview project actually deployed | Not set up (W2 parked it) | ⚠️ C4 |

## 2. Languages (brief §2, §6)

| Brief | Repo | |
|---|---|---|
| sq default + en, it, de, el, fr, tr, es | sq default + en, it, de, fr, es, **pl, ru** | ⚠️ C1 |
| Namespaces per area | One file per language, keys grouped by area (`search.*`, `listing.*`) | ✅ same effect |
| Intl formatting | `lib/format.ts` | ✅ |
| Device language detection | Yes | ✅ |

## 3. Screens (brief §3)

| Brief route | Repo | |
|---|---|---|
| Home | `app/(tabs)/index.tsx` | ✅ |
| Search + filters + list/map | `app/(tabs)/explore.tsx`, `components/property/filter-sheet.tsx` | ✅ |
| **Wanted homes board (tab)** | Buyer posts and manages own requests in `app/saved-searches`; agents see 10 open ones on `app/agent-dashboard` | 🟡 no public board, not prominent (C5) |
| Messages / chat | `app/(tabs)/messages.tsx`, `app/messages/[id].tsx` (realtime, photos, unread) | ✅ |
| Profile, favorites, my listings, settings | `app/(tabs)/profile.tsx`, `app/favorites`, `app/my-listings` | ✅ |
| Property detail | `app/property/[id].tsx` | ✅ |
| Create / edit listing | `app/listing/new.tsx`, `app/listing/[id]/edit.tsx` (drafts, photos, map pin) | ✅ |
| Agent profile | `app/agent/[id].tsx`, `app/user/[id].tsx`, `app/agents` | ✅ |
| Viewings | `app/viewings` (request, confirm, reschedule, cancel) | ✅ |
| Auth: sign-in, sign-up, forgot password | Inside the Profile tab (`components/auth/signed-out-start.tsx`) | ✅ |
| Legal: terms, privacy, **cookies** | `app/terms.tsx`, `app/privacy.tsx`; no cookies page | 🟡 |
| Concierge (AI) | `app/assistant.tsx`, **parked** by owner (C2 in DECISIONS.md) | ⚠️ stays parked |
| `/admin` | `app/moderation.web.tsx` (reports: dismiss, hide). No agent verification screen, no stats | 🟡 C6 |

## 4. Features (brief §3 core features)

| # | Brief | Repo | |
|---|---|---|---|
| 1 | Search filters: city, zone, price, type, rooms, baths, m², features; sort; saved searches with alerts | All live; alerts by email and push | ✅ |
| 1 | Filters for floor, furnished, parking, elevator, sea view | Through "features"; no floor filter | 🟡 minor |
| 2 | Gallery, facts, map, agent card, share, favorite, report, chat/call/WhatsApp, viewing | All live | ✅ |
| 2 | **Price history** | No table, nothing shown | ❌ needs DB (C6) |
| 3 | Create, edit, pause, sold/rented, drafts, compression, map pin | Live | ✅ |
| 3 | Renew a listing | Not checked as a separate action | 🟡 minor |
| 4 | Wanted homes: post, agents respond | Post: yes. Respond: agent dashboard only | 🟡 C5 |
| 6–7 | Messaging, viewings | Live | ✅ |
| 8 | Email, Google, Apple, LinkedIn | Live. Apple provider off (audit High) | 🟡 owner console step |
| 8 | Roles buyer / owner / agent / admin | Live: client/buyer, agent; moderators by table | ✅ keep (planned roles in CLAUDE.md) |
| 9 | Verified badge on agents | Shown on profiles | ✅ |
| 11 | **Currency toggle ALL/EUR/USD/GBP** with daily rates | Price shown in the listing's own currency only | ❌ needs DB + scheduled function (C6) |
| 11 | Remote-buying guide for the diaspora | None | ❌ content page (C5) |

## 5. Database (brief §4)

Live schema stays (C3). Tables the brief names that do not exist under any
name: `agencies` (we have `profiles.agency_name`), `price_history`,
exchange rates. `reports` exists as `content_reports`; `property_images` is
a column on `properties`; conversations are two-party, no participants
table. Seed data: not on the live database (it has real listings).

## 6. AI (brief §5)

| Brief | Repo | |
|---|---|---|
| Listing Integrity Engine (score, duplicate photos) | None | ❌ needs DB + AI key |
| Fair price ("Çmim i Drejtë") | None; flagged in DECISIONS.md as price insight | ❌ needs DB + AI key |
| Diaspora Concierge | Built, parked (C2) | ⚠️ |
| Existing | listing translation, AI search, listing-writing help | ✅ |

The Anthropic key was rejected on 2026-11-04; any new AI work needs a new key first.

## 7. Website and SEO (brief §6, §7)

| Brief | Repo | |
|---|---|---|
| `web.output: "static"`, favicon | `app.json` | ✅ |
| theme colour meta | Not set | ❌ small |
| Per-page title, description, Open Graph | `components/web/page-head.tsx`; listing pages pre-rendered with image + canonical | ✅ |
| **hreflang** alternates | None (the language lives on the device, not in the URL) | ❌ |
| Canonical on non-listing pages | Listing pages only | 🟡 |
| Clean URLs `/sq/prona/tirane/apartament-2-plus-1` | `/property/<id>` | ⚠️ changing URLs breaks shared links; recommend keep |
| sitemap.xml, robots.txt | Written at build from the database | ✅ |
| **Responsive: 2 columns tablet, desktop multi-column with left filter sidebar** | 480px phone column on every screen (`constants/web-frame.ts`) | ⚠️ C2 |
| Lighthouse ≥85 / ≥95 / ≥95 | Not measured. Two known limits: one ~0.9 MB script (W1 trade-off) and white-on-orange contrast (owner kept the orange, DECISIONS.md C1), which alone may keep Accessibility under 95 | 🟡 |
| Map library only on map pages | Not checked | 🟡 |

## 8. Non-functional (brief §9)

| Brief | Repo | |
|---|---|---|
| Labels, 44pt targets, screen reader | axe checks in `e2e-expo/a11y.spec.ts` | ✅ |
| FlashList | FlatList with pagination (24, load more) | ✅ fine at current size |
| Empty / error / retry states | Rule in CLAUDE.md, enforced | ✅ |
| **Cookie banner** | None. The site sets no tracking cookies (sign-in uses browser storage), so a consent banner is not required; a short cookies page is | 🟡 |
| Account deletion | `delete-account` function, Profile | ✅ |
| **Data export request** | None | ❌ |
| Error tracking | Own `client_errors` table instead of Sentry | ✅ |

## 9. Mobile release (brief §8)

Out of scope for the website. EAS profiles, push, deep links (AUDIT-008)
already exist.

---

## Decisions needed from the owner

- **C1 Languages.** Brief: el + tr. App: pl + ru. Options: keep pl + ru;
  add el + tr (10 languages, machine-translated, flagged for review); swap.
  *Recommend: add el + tr, keep pl + ru* (Greece is a diaspora market).
- **C2 Desktop layout.** Today every screen is a 480px phone column on the
  web. The brief wants 2 columns on tablet and a desktop page with a left
  filter sidebar. Desktop is the largest piece of work here and changes how
  the app looks on wide screens. *Recommend: desktop layout for Home, Search
  and Property only, everything else stays a centred column.*
- **C3 Database names.** *Keep the live schema* (no renames).
- **C4 Domain and deploy.** W2 keeps the production domain on the Vite site.
  Building does not need the domain. Separate questions: set up the
  `deploy/expo-web` preview project on Vercel (free), and later move the
  domain (stage 2). *Recommend: preview yes, domain not yet.*
- **C5 Small additions without database changes**, built now unless you say
  no: hreflang + canonical + theme colour; cookies page; public wanted-homes
  board on the web with a "respond" button for agents; remote-buying guide
  page; data-export request (by email to support).
- **C6 Need a live database change** (each needs your yes): price history;
  currency toggle with daily rates; agent verification + stats in
  moderation; fair price; listing integrity. *Recommend: price history and
  currency now; fair price and integrity after a new Anthropic key.*

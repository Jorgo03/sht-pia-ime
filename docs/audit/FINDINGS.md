# Findings: Shtëpia.ime full sweep (checkpoint 1)

Updated 2026-11-13, branch `audit/full-sweep`.

- **Evidence:** every finding cites a file:line, a command output, a live query, or repro steps. Anything not reproduced is marked **SUSPECTED**.
- **Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.
- **Full evidence** for AUDIT-001 to AUDIT-023 is in `AUDIT_REPORT.md`, with each fix's test, before/after numbers and commit.

## Health score

| When | Score | Basis |
|---|---|---|
| Before the first pass (13 Nov) | **7/10** (6.5) | 0 Critical, 2 High, 6 Medium, 15 Low. Viewing data could be corrupted through the API. A failed load looked like a deleted listing. Time zones were wrong for diaspora users. |
| Now | **8/10** | 0 Critical. 1 High open, and it is the owner's setting. All checks green. RLS verified on every table on the live database (51/51). |

## Counts

| Severity | Found | Fixed | Open, code | Open, owner or needs an OK | Deferred |
|---|---|---|---|---|---|
| 🔴 Critical | 0 | 0 | 0 | 0 | 0 |
| 🟠 High | 2 | 1 | 0 | 1 (AUDIT-002) | 0 |
| 🟡 Medium | 8 | 5 | 1 (024) | 2 (008 domain, 025 schema) | 0 |
| ⚪ Low | 20 | 6 | 3 (026, 027, 028) | 8 (009, 013, 016, 019, 022, 023, 029, 030) | 3 (018, 020, 021) |
| **Total** | **30** | **12** | **4** | **11** | **3** |

## All findings

| ID | Sev | Area | Platform | Problem | Evidence | Status / commit |
|---|---|---|---|---|---|---|
| AUDIT-001 | 🟠 | Auth | all | "Continue with Apple" was shown, but the Apple provider is off, so it always failed | `/auth/v1/settings` has no `apple`; `app/(tabs)/profile.tsx:1445` | ✅ `d8f4bf0`. Owner: turn Apple on before App Store review |
| AUDIT-002 | 🟠 | Auth config | all | Confirm email is off: an API sign-up gets a confirmed session for any address, skipping the app's code check | `mailer_autoconfirm: true`; DECISIONS.md:932 | 👤 Owner: turn it on once SMTP works |
| AUDIT-003 | 🟡 | Viewings | backend | Double booking per listing or per agent | `rls_full_matrix.sql` D1 | ✅ `8edec5c`, live (`20261113194212`) |
| AUDIT-004 | 🟡 | Viewings | backend | A client could re-time a confirmed viewing, even into the past, and it stayed confirmed | `rls_full_matrix.sql` D2, D3 | ✅ `4b4e74f`, live (`20261113194202`) |
| AUDIT-005 | 🟡 | Viewings / time | all | Times followed the device's zone, not Europe/Tirane | `app/viewings/index.tsx:62` (before) | ✅ `83486c4` |
| AUDIT-006 | 🟡 | UX states | all | Any failed listing load was shown as "no longer available", with no retry | `data/properties.ts:219` (before) | ✅ `93f74b4`, e2e X103 |
| AUDIT-007 | 🟡 | Privacy | all | Account deletion left the person's chat files in storage | `delete-account/index.ts:57` (before) | ✅ `ef96e81`, deployed v2 |
| AUDIT-008 | 🟡 | Deep links | iOS, Android | No universal links or app links: shared listing links open the website | `app.json` has no `associatedDomains` / `intentFilters` | 👤 Needs the domain |
| **AUDIT-024** | 🟡 | Chat | iOS, Android, web | A thread left open does not catch up after a dropped connection or after the app returns from the background. Messages sent meanwhile appear only when the thread is reopened. The unread badge has the same problem. | `app/messages/[id].tsx:200-214`: `.subscribe()` with no status callback, and no `AppState` listener; `hooks/use-unread-messages.ts:57` the same. Supabase Realtime `postgres_changes` does not replay missed rows. Confirmed in code; not reproduced on a device. | Open: refetch when the channel resubscribes and when the app becomes active again |
| **AUDIT-025** | 🟡 | Wanted homes | backend | Nothing tells a buyer when a listing matching their "wanted home" is published, or tells agents about a new wanted home. Agents see only the newest 10 open ones, from any city. | Live: the only DB function that mentions `wanted_homes` is `buyer_has_open_wanted_home`, with no trigger. `app/agent-dashboard/index.tsx:124` `.limit(10)` with no city filter. | Open: a notification trigger on publish (schema change, **needs OK**) |
| AUDIT-009 | ⚪ | Offline | iOS, Android | No offline detection or banner | `lib/query-client.ts`; no NetInfo | Open: needs an OK for the new dependency |
| AUDIT-010 | ⚪ | Dependencies | dev | npm audit warnings | `npm audit` | ✅ `5efa93f`: 1 high fixed; 8 moderate remain, dev/build only |
| AUDIT-011 | ⚪ | Dependencies | iOS, Android | Expo patch versions behind | `expo-doctor` | ✅ `2d603df`, now 20/20 |
| AUDIT-012 | ⚪ | Migrations | backend | Local migration version differed from the live one | `list_migrations` | ✅ `97e2fd3` |
| AUDIT-013 | ⚪ | Secrets hygiene | local | `.env.local.backup` holds a Clerk secret and a Vercel token (gitignored) | key names in the file | 👤 Delete the file, rotate the Clerk secret |
| AUDIT-014 | ⚪ | Config docs | all | 13 env vars missing from `.env.example` | grep | ✅ `a3e472b` |
| AUDIT-015 | ⚪ | Performance | all | My listings and Messages loaded every row at once | code | ✅ `a1f8f30` |
| AUDIT-016 | ⚪ | Storage | backend | `property-images` takes 50 MB of any type; the apps cap images at 10 MB | bucket row; `lib/upload.ts:35` | Open: whether a policy can check file size needs a live upload test, and a video bucket needs the owner |
| AUDIT-017 | ⚪ | DB grants | backend | `anon` held grants on 12 private tables | `has_table_privilege` | ✅ `4985974`, live (`20261113194218`), 8/8 |
| AUDIT-018 | ⚪ | Code quality | all | 34 `set-state-in-effect` lint warnings | lint | Deferred: fix when those screens are touched |
| AUDIT-019 | ⚪ | Cleanup | backend | The retired `ai-generate-listing` stub is still deployed | `list_edge_functions` | 👤 Owner decides |
| AUDIT-020 | ⚪ | Repo | Android | Stale local `android/` prebuild folder | `ls android` | Deferred: delete before the first local Android build |
| AUDIT-021 | ⚪ | Expo web | web | 22 `Alert.alert` calls show nothing on the Expo web build | grep | Parked with the web build (QA-06) |
| AUDIT-022 | ⚪ | Auth | all | Leaked-password protection is off | advisor | 👤 Needs Supabase Pro |
| AUDIT-023 | ⚪ | Auth | all | LinkedIn sign-in is on live but never tested | `/auth/v1/settings` | 👤 Test it, or turn it off |
| **AUDIT-026** | ⚪ | Types | all | No generated Supabase types; the hand-written ones have drifted (`Property.agent_id: string`, but the column is nullable) | `data/types.ts:3`; live `information_schema` (`agent_id` nullable) | Open: generate `lib/database.types.ts` and type both clients |
| **AUDIT-027** | ⚪ | SEO | web | `/favicon.ico` and `/manifest.json` return the HTML page (the site's catch-all route), so search engines and browsers asking for them get no icon | `curl` live: `/favicon.ico` 200 `text/html`; `public/` has only `favicon.svg` | Open: add `favicon.ico` and a web manifest |
| **AUDIT-028** | ⚪ | Favourites | all | SUSPECTED: two very fast taps read the same stale `favoriteIds`, send two inserts, and the second fails on the unique key. It heals itself by re-fetching, but the heart flickers. | `contexts/favorites-context.tsx:113` (`wasFav` from the render closure) | Open: confirm first, then guard with an in-flight set |
| **AUDIT-029** | ⚪ | AI cost | backend | `ai-parse-search` and `ai-listing-assistant` use Claude Haiku 4.5 (still served). Haiku 5.5 is the current Haiku at a tenth of the input price, but moving means breaking changes. | `ai-parse-search/index.ts:26`, `ai-listing-assistant/index.ts:29`; Anthropic model table | 👤 Owner decides (AI chat is off; search parsing only) |
| **AUDIT-030** | ⚪ | Monitoring | iOS, Android, web | No third-party crash monitoring. The in-house `client_errors` reporting runs only in release builds, so it has never fired (table empty). | `lib/report-error.ts:20`; `client_errors` has 0 rows | 👤 Keep the in-house reporting, or add Sentry (new dependency and account) |

**Checked and sound:**
- Favourites roll back on failure: they re-fetch the server state (`favorites-context.tsx:142-158`).
- Every AI call has a timeout (15–60 s), a per-account rate limit with a friendly 429, output bound to a schema, and a 503 fallback.
- Both AI model IDs are valid.
- Chat history is capped, and realtime duplicates are filtered.
- The live website returns 200 with a title, description, Open Graph tags, robots.txt and sitemap, plus HSTS, `frame-ancestors 'none'` and `nosniff`.
- RLS holds on all 29 tables on the live database (51/51). Signed-out access is limited to listings, plans and view counts.

**Not covered:**
- **Vercel deployments and runtime errors:** the Vercel connector has no access to this team, and the CLI isn't installed. 👤 Approve team access for the connector to cover it.
- **Native devices:** not available here. The Expo web build in phone and desktop sizes stands in.

## Fix order (after this checkpoint)

1. **AUDIT-024** (🟡, code): chat and unread badge catch up on reconnect and on foreground. Failing test first.
2. **AUDIT-027** (⚪): `favicon.ico` and web manifest.
3. **AUDIT-028** (⚪): reproduce first; fix only if confirmed.
4. **AUDIT-026** (⚪): generated database types, wired into both clients without changing behaviour.
5. Then the reports: `docs/audit/AUDIT_REPORT.md`, `docs/LAUNCH_PLAN.md` (checked against the current Apple, Google, Expo, Vercel and Supabase docs), and the PR.

**Waiting on the owner (not started without an OK):**
- AUDIT-025: schema, a notification trigger.
- AUDIT-009: a new dependency.
- AUDIT-016: a storage policy, after a live upload test.
- Auth configuration: AUDIT-002, 022, 023, and the Apple provider for 001.
- Owner-only items: AUDIT-008, 013, 019, 029, 030.

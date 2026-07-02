# Pre-Launch Audit — Shtëpia.ime (Vite web app)

Date: 2026-07-02 · Auditor: Claude Code (autonomous pass)
Scope: `src/` (active Vite app), Supabase project `xzzzhlwmzotibrxdqmcm`, i18n, RLS, storage, OAuth.

> **Note on the 13-step plan:** the plan text was not included in the prompt
> (the placeholder was left empty), so plan-vs-reality gaps below are
> reconstructed from what the schema/code imply was intended. See §6.

---

## 1. SEVERITY 1 — Breaks the whole app

### 1.1 Supabase project was PAUSED (status: INACTIVE)
The entire backend was offline — every query, auth call, and image URL failed.
**Action taken:** restored the project during the audit (non-destructive; no
keys touched). Root cause: free-tier auto-pause after inactivity. Long-term:
upgrade the project or set up a keep-alive ping; logged in DECISIONS.md.

### 1.2 Buyers cannot publish listings — `properties.agent_id` is NOT NULL
`NewListing.jsx` inserts `agent_id: null` for non-agent users, but the column
is `NOT NULL` (legacy from when only agents could list). Every buyer/client
submission fails with a 23502 violation. The error is shown, but there is no
way around it. **Fix: migration to make `agent_id` nullable** (owner_id is the
canonical owner; RLS already keys on it).

### 1.3 RLS enabled with ZERO policies on 7 tables
`conversations`, `messages`, `leads`, `saved_searches`, `viewings`,
`wanted_homes`, `property_views` all have RLS on and no policies → all reads
return empty, all writes are rejected. Silent casualties:
- AddSheet "Save search" / "Wanted home" / "New lead" forms: insert fails and
  the form **silently closes as if it succeeded** (see 3.6).
- `useUnreadCount` (nav badge) always 0.
- `useProfileStats` saved-searches / viewings counts always 0.
**Fix: add buyer/agent-scoped policies for all 7 tables** (see migration).

### 1.4 Realtime publication is empty
`supabase_realtime` publication contains no tables, so the
`postgres_changes` subscription in `useUnreadCount` (and any future messaging
realtime) never fires. **Fix: add `conversations` + `messages` to the
publication.**

---

## 2. SEVERITY 2 — Breaks a feature

### 2.1 Agent signups can lose their role (become `buyer`)
`handle_new_user` trigger only copies `full_name`/`avatar_url`; it ignores
`role` and `agency_name` metadata. The client-side follow-up
`profiles.update(...)` in `AuthContext.signUp` only works when a session
exists — with email confirmation enabled there is no session yet, RLS blocks
the update, and the profile stays at the DB default `'buyer'`.
**Fix: trigger reads `role`, `agency_name`, `preferred_language` from
`raw_user_meta_data` (validated).**

### 2.2 Language preference never persists
`Header.jsx` writes `profiles.language` — that column does not exist
(real column: `preferred_language`). The update fails silently, so the
chosen language never syncs across devices. `AuthContext` reads
`profile.language || profile.preferred_language` (dead first branch).
**Fix: use `preferred_language` in both places.**

### 2.3 `sq` (fallback locale!) missing 10 actively-used keys
Albanian users see raw keys (`search.headline`, `favourites.savedCount`, …)
on the Search and Favorites screens. Locale sync status: en 291 keys,
sq 259, pl/ru 232, de/es/fr/it 230 (union 294). **Fix: sync all 8 locales to
the same key set.**

### 2.4 Stored property translations are ignored
The wizard writes `title_i18n` / `description_i18n` (8 languages, and there
is a migration + GIN indexes for them), but `useTranslatedProperty` never
reads them — it always calls the `translate-description` edge function
(cost + latency + flash of untranslated text). Two competing translation
architectures. **Fix: prefer the stored `*_i18n` values; fall back to the
edge function only when the language is missing.**

### 2.5 Agent "listings" stat always 0
`useProfileStats` counts `properties` with `status = 'published'` — that
status does not exist anywhere; the app writes `'active'`. **Fix: 'active'.**

### 2.6 `video_url` collected but never saved
NewListing step 4 has a video URL field, the DB has the column, and the
insert payload omits it. **Fix: include it.**

### 2.7 WhatsApp messages can go to a stranger
`PropertyDetail` falls back to hardcoded phone `'355691234567'` when a
listing has no contact phone → "Schedule viewing" opens WhatsApp to a random
real number. **Fix: hide contact CTAs when there is no phone.**

### 2.8 Messaging is a mock (plan gap, half-built)
Full schema exists (`conversations`, `messages`, unread counters,
`useUnreadCount` hook) but `Messages.jsx` renders hardcoded mock
conversations + "coming soon". **Fix: build a functional conversation list +
thread view with send, mark-read, and realtime updates** (needs 1.3 + 1.4).

---

## 3. SEVERITY 3 — Wrong/risky but survivable

### 3.1 `formatPrice` hardcodes EUR
Listings can be EUR / ALL / USD (wizard + DB `currency` column), but every
price renders as €. **Fix: pass the listing currency through.**

### 3.2 Hardcoded user-facing strings (i18n constraint violations)
- `AuthCallback.jsx`: "Duke u kyçur…" (Albanian)
- `Profile.jsx`: "NEW ACCOUNT", "WELCOME BACK", "Start finding home today.",
  "Your next door is open."
- `Home.jsx`: "· Tirana" (also a dead conditional — both branches identical),
  "Albania", "{n} homes"
- `PropertyDetail.jsx`: stat labels "Beds/Baths/Area/Year", raw
  `property_type`, raw feature names (not through `listing.feature.*`)
- `Favorites.jsx`: "Loading", "FAVORITES", "Your …", "/mo" suffix
**Fix: route all through i18next; add keys to all 8 locales.**

### 3.3 Overly-permissive `properties` SELECT policy
`qual: true` exposes drafts/paused listings (incl. contact phone/email) of
every user to anyone who queries the table directly. **Fix:
`status = 'active' OR owner/agent`.** (Public pages only show active anyway.)

### 3.4 Storage policy sprawl on `property-images`
3 INSERT policies (an agent-only one made meaningless by two broader
unscoped ones), 2 SELECT, 2 UPDATE, 3 DELETE — some folder-scoped, some
owner-scoped. Net effect: any authenticated user can upload to *any* path.
**Fix: consolidate to one folder-scoped policy per operation.**
`avatars` bucket has **no policies at all** (uploads impossible; public read
only works because the bucket is public). Added own-folder write policies.

### 3.5 Role model inconsistency
DB default `'buyer'`, signup writes `'client'`, code checks accept both,
`Messages.jsx` reads `user_metadata.role` while everything else uses
`profile.role`. **Fix: keep accepting both values (data may contain either),
but make Messages.jsx use the profile-based `isAgent` like the rest.**

### 3.6 AddSheet swallows insert errors
`else onClose()` — failures look like success. **Fix: show error toast.**

### 3.7 Debug leftovers
`console.log('[TOAST] …')` in WelcomeToast. Test scripts + screenshots
(`test-*.cjs`, `test-*.png`) at repo root (left in place; flagged).

---

## 4. Code smells / dead-or-unwired code (documented, mostly left alone)

- **Hybrid repo:** the Expo RN app (`app/`, `components/`, `contexts/`,
  `data/`, `lib/*.ts`) and the Vite web app (`src/`) coexist; `package.json`
  mixes both worlds; CLAUDE.md documents only the Expo app (stale).
- **Unwired components** (plausible future features, DB columns exist —
  kept): `floorplan/FloorPlanEditor|Viewer` (DB `floor_plan` jsonb exists),
  `AutoTranslateButton.jsx` (edge fn `translate-property` deployed),
  `CustomDropdown.jsx`.
- **Unused:** `QueryCache` provider mounted in App.jsx but no consumer;
  `@vis.gl/react-google-maps` dependency unused in either app.
- `useProperties.usePropertiesByIds` uses `JSON.stringify(ids)` as dep (works,
  smelly). `property_activity` INSERT policy is `true` (spammable analytics —
  acceptable, noted).
- Search filter sheet lacks `daily_rent` option though the wizard can create
  daily-rent listings.

---

## 5. OAuth status

- **Google** — implemented and reported working (PKCE, redirect to
  `/auth/callback`, handled by `AuthCallback.jsx`). ✔
- **Apple** — nothing in the web app: no button, no provider call. The old
  Expo app has native Apple sign-in, but the web app has zero Apple code.
- **LinkedIn** — nothing anywhere: no button, no provider call.
- Client code needs only `signInWithProvider('apple' | 'linkedin_oidc')` +
  buttons (added in this pass, gated until providers are configured — see
  DECISIONS.md for the exact dashboard/provider-console checklist; I cannot
  and did not create any credentials).

---

## 6. Reconstructed plan status (plan text was not provided)

| Area (inferred step) | Status |
|---|---|
| Project scaffold (Vite + router + theme) | done |
| i18n (8 locales) | done, locales out of sync (fixed) |
| Auth: email/password + OTP | done |
| Auth: Google OAuth | done |
| Auth: Apple + LinkedIn | **not started** (console setup needed) |
| Property browse/search/filters/map | done |
| Property detail + translation | done, used edge fn instead of stored i18n (fixed) |
| Favorites | done (worked once backend restored) |
| Listing wizard (draft → publish) | half-done: buyer publish broken, video_url dropped (fixed) |
| Listing management (my-listings, dashboard) | done |
| Saved searches / wanted / leads (AddSheet) | half-done: UI exists, RLS blocked all writes (fixed); no UI to view saved searches |
| Messaging | **schema only; UI was a mock** (functional v1 built in this pass) |
| Viewings scheduling | schema only; "Book a visit" navigates to a search page that ignores the intent |
| Agent dashboard | placeholder ("coming soon") |

---

## 7. Fix order (Phase 2)

1. DB migrations: agent_id nullable · RLS for 7 tables · properties SELECT
   tightening · storage consolidation · handle_new_user role fix · realtime
   publication.
2. Locale sync (all 8 files) + new keys for previously hardcoded strings.
3. Code fixes: language column, stats status, video_url, currency,
   translations-from-DB, fake phone, AddSheet errors, hardcoded strings,
   Messages role source, console.log.
4. Messaging v1 (list + thread + send + mark-read + realtime).
5. OAuth buttons (Apple/LinkedIn) behind provider config, checklist in
   DECISIONS.md.
6. Browser verification of each screen.

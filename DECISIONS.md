# DECISIONS.md — needs your input / your console access

Things I could not (or should not) resolve autonomously. Everything else in
AUDIT.md was fixed; see the final report for the change log.

---

## ═══ AUTH INCIDENT REMEDIATION — 2026-08-19 ═══

Full findings in `AUTH_AUDIT.md`; fixes on branch `fix/auth-recovery-and-validation`.
One judgment call from that pass needs your read, since I deliberately left
a security-advisor finding half-addressed rather than risk breaking a working
feature:

**`current_user_is_agent()` / `buyer_has_open_wanted_home(uuid)` are still
callable by `anon`.** Supabase's security advisor flags this (both are
`SECURITY DEFINER`). I fixed the same finding for a third function,
`claim_role`, which was risk-free to tighten. These two are different: both
run *inside* `public.profiles`' own SELECT policy, which `anon` also
evaluates for the public `/agent/:id` page and property-listing agent info —
logged-out visitors reading an agent's profile is an intentional feature, not
a bug. For an agent row, `role = 'agent'` short-circuits before either
function is ever called, so revoking `anon`'s access wouldn't touch that
path. But for a *non-agent* row, none of the policy's earlier conditions are
true for an anonymous caller, so Postgres has to evaluate the function call
to resolve the expression — and if `anon` lacks EXECUTE, that's not "row
excluded," it's the whole query erroring out with "permission denied." I
could not fully verify every anon-reachable query path never touches a
non-agent row, so I left this alone rather than risk silently breaking the
public agent-profile pages.

The clean fix is restructuring the policy so an anon caller never reaches
that branch at all — something like adding an explicit `auth.role() =
'authenticated' AND (...)` guard around the wanted-home clause, so the
function calls are structurally unreachable for anon instead of merely
returning false. That's a real but small policy change, deliberately not
made in this pass since it wasn't the confirmed incident and deserves its
own focused review rather than being bundled into an auth-recovery fix. Say
the word and I'll do it as its own change, with the same before/after
verification approach as the rest of this pass.

## ═══ MASTER-PLAN PASS — 2026-07-13 (branch feature/booking-otp-ai-polish) ═══

### MP1. OAuth providers — how Task 1 maps to reality

**How Google is wired (audit):** `Profile.jsx` button →
`AuthContext.signInWithProvider('google')` → `supabase.auth.signInWithOAuth`
(PKCE, `redirectTo: {origin}/auth/callback`, no extra queryParams — the
offline/consent params were removed 2026-07-12 after they caused Google's
legacy consent screen to hang). GoTrue handles the provider handshake at
`https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`; the app's
`/auth/callback` route exchanges the code and fails fast on error params.
User rows land in `auth.users` (provider recorded in
`raw_app_meta_data.provider` / `auth.identities`); `handle_new_user` creates
the `profiles` row. **There is no custom `users` table and none is needed —
the plan's "provider column" is Supabase's identities table.**

**Duplicate accounts across providers:** GoTrue links sign-ins to one user
by verified e-mail (identity linking) — a second provider with the same
verified address attaches to the existing user rather than duplicating.
No app code required.

**Apple + LinkedIn:** fully implemented app-side
(`signInWithProvider('apple' | 'linkedin_oidc')`, shared callback, error
states). Buttons removed 2026-07-12 at owner's request until the providers
are actually enabled in the dashboard (they still show as disabled in GoTrue
settings — §P2-G). Re-adding = paste the two buttons back in Profile.jsx.
This plan task does NOT override that newer decision.

**Microsoft/Outlook (azure):** still the CLAUDE.md open question — decide
in-scope first. When yes, the checklist is:
1. Azure Portal → Entra ID → App registrations → New registration
   (supported accounts: personal + work/school for consumer Outlook).
2. Redirect URI (Web): `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`.
3. Certificates & secrets → new client secret → copy the VALUE immediately.
4. Supabase Dashboard → Auth → Providers → **Azure**: enable, paste
   Application (client) ID + secret; set the tenant URL if restricting.
5. App code: one button calling `signInWithProvider('azure')` with
   `options.scopes: 'email'` — the existing pattern handles the rest.

### MP2. Test-listing cleanup — AWAITING YOUR APPROVAL + review-gate call

**Deletion candidates (nothing deleted):** the 8 listings owned by
`system@shtepia.ime` (created 2026-05-15, Unsplash stock photos, all
"Tiranë …" — Blloku ×2, Myslym Shyri, Selvia, Liqeni i Thatë, Komuna e
Parisit, Don Bosko, + the €650 rental). One more listing is YOURS
("Aparrtament modern 2+1 Pazar i Ri", jorgo.dhaskali@gmail.com, real photos,
2026-07-12) — kept unless you say otherwise. Reply "delete the 8 seed
listings" and it's one statement.

**Review gate:** `pending_review` is now a legal status and RLS already
hides it from the public. The publish default was NOT flipped: there is no
admin/review UI (Super Admin is a planned role), so defaulting new listings
to pending_review would strand every listing invisible with nobody able to
approve it. When the admin role ships, flipping the default is a one-line
change in NewListing.jsx + a review queue screen.

### MP4. Reminders — what shipped vs. what's infra-gated

The plan's `meetings` table already exists as `viewings` (agent_id,
property_id, client, datetime, status, notes — richer than spec'd), so no
new table. Shipped: header notification bell for signed-in users — badge
with the count of requested/confirmed viewings in the next 48h, dropdown
listing the next 5 with date/time/status, links to /viewings; refreshes
every 5 min. **Not shipped: the 30-minutes-before email/push reminder** —
it needs (a) an email provider (P2-D still unanswered) and (b) push infra
that doesn't exist for this web app (would be Web Push + service worker, or
FCM if the Expo app ever ships). Pick the email provider and I'll build the
pg_cron + Edge Function pipeline next pass.

### MP5. Request broadcast — mapped onto wanted_homes

`requests` table ≙ existing `wanted_homes`; "broadcast to relevant agents" ≙
the agent-dashboard "Buyers looking now" feed (already live); "My Requests"
≙ /saved-searches wanted tab (already live). Newly shipped: natural-language
entry on the wanted-home form — free text → `ai-parse-search` Edge Function
(needs ANTHROPIC_API_KEY set, §0; degrades to manual fields) → prefills
city/type/budget/beds, plus a live "listings matching right now: N" count.
Proactive push notifications to agents on new requests: same infra gap as
MP4 — logged, not faked.

### MP7. Store deployment prep — needs the Expo-vs-web decision first

Task 7 (app.json bundle IDs, EAS profiles, store builds) targets the
**legacy Expo tree**, but the shipping product is the Vite web app — the
Expo app hasn't been touched since the July migration and lacks every
feature built since (messaging, viewings, saved searches, AI, the redesign).
Doing EAS work now would ship a stale prototype to the stores. Decide first
(DECISIONS §11): (a) mobile = PWA wrapper of the web app (Capacitor — one
codebase, fastest to store), (b) revive the Expo app (weeks of re-porting),
or (c) web-only for launch. What DOES apply today regardless:
- Production **Site URL + Redirect URLs** in Supabase Auth config before
  launch (§4) — currently localhost-only.
- **Privacy policy page** — required by both stores AND by GDPR for the web
  app; needs your data-retention answers before I draft it in 8 languages.
- **Moderation** — the pending_review status from MP2 is the hook; needs
  the admin role/UI.

### MP-note. Model names in the plan
The plan's "Sonnet 4.6 / Opus 4.6" don't exist (current: Sonnet 5,
Opus 4.8, Haiku 4.5), and its claim that "there is no Anthropic model named
Fable" is wrong — Fable 5 is the model that executed this pass. Harmless,
but worth knowing the plan was drafted against stale model knowledge.

## ═══ VISUAL PASS — 2026-07-12 (branch feature/visual-redesign) ═══

### V-1. ui-ux-pro-max skill not installed
The mission's Phase-1 script does not exist in this repo (`skills/` absent).
`design-system/MASTER.md` was authored by hand to the same parameters
(variance 7 / motion 6 / density 5) on top of the existing token system.
Install the skill and re-run if you want its generated baseline compared.

### V-2. Navy (#0a2f63) added as token only
The brand navy now exists as `--fho-navy` (lifted to `#9db8e0` in dark theme
for contrast) but is not yet APPLIED anywhere — the warm-paper + orange
identity is strong and injecting navy without a product surface for "trust"
elements (verified badges, agency links) risked muddying it. Sanity-check:
tell me where you want navy used and it's a one-line change per spot.

### V-3. New feature pages left inline-styled
Viewings / SavedSearches / AgentDashboard / PropertyDashboard use inline
styles (written pre-redesign). They inherit global focus/stagger polish only.
Restyling them to CSS classes is mechanical but touches brand-new features —
deferred to keep this pass zero-risk.

### V-4. MyListings 30px icon buttons kept
Below the 40px touch floor, but the dense row layout depends on them.
Flagged, not changed — say the word and I'll enlarge to 38px with tighter
padding.

### V-5. Verification method
The Claude browser-pane screenshot pipeline died mid-session (harness bug),
so visual verification used headless Chrome captures (both themes, Home +
Detail + Profile + Search) plus computed-style probes. A temporary
`public/__set-theme-light.html` helper was created for light-theme capture
and deleted afterwards.

## ═══ PASS 2 — 2026-07-11 ═══

### P2-A. Phase 3 feature log (built / skipped)

**Built:**
- **Viewing scheduling end-to-end** — schema + RLS existed with zero UI; the
  single biggest missing marketplace loop (every comparable portal has tour
  booking). Property-page CTA → request sheet → `/viewings` manage page
  (client cancel / owner confirm-decline). RLS verified as client, owner,
  and stranger via transaction-scoped SQL simulation.
- **Saved searches + wanted homes management (`/saved-searches`)** — both
  create-flows existed but no view/run/delete UI; data went in, nothing came
  out. Wires the previously-dead Profile row.
- **Agent dashboard v1** — replaced the "coming soon" placeholder: active
  listings / 30-day views / conversations / leads stat cards, pending
  viewing requests inline (confirm/decline), and the open wanted-homes feed
  (Indomio-style reverse marketplace, agent side — RLS already allowed it).
- **Search sorting** (newest / price ↑ / price ↓) — table stakes; URL-param
  driven so share/back behave.

**Skipped, with rationale:**
- **Price insight** — still flagged per your standing constraint (§0b below);
  decision checklist unanswered.
- **AI recommendations / photo tagging** — ANTHROPIC_API_KEY still unset
  (§0); building more AI surface before the existing three features can even
  run adds nothing.
- **Mortgage calculator** — high value for diaspora buyers but needs a
  product decision on Albanian bank rate assumptions; a wrong default rate
  is worse than no calculator.
- **Saved-search email alerts** — `alerts_enabled` toggle now exists in the
  UI, but sending requires cron + email infrastructure (Resend/SES +
  pg_cron); infra choice is yours (see P2-D).

### P2-G. Apple/LinkedIn: credentials entered, but the providers are NOT enabled (2026-07-12)

Verified live against GoTrue (`/auth/v1/settings`): `apple: false`,
`linkedin_oidc: false`, `google: true`. Clicking either button reaches the
correct authorize URL and GoTrue answers
`400 "Unsupported provider: provider is not enabled"`. The client ID/secret
being saved is not enough — the provider's **Enable** toggle in
Dashboard → Authentication → Providers must be on (and the change saved).
App-side wiring is complete and verified; no code change is needed after
you flip the toggles. Note LinkedIn has two dashboard entries — enable
**LinkedIn (OIDC)**, not the deprecated "LinkedIn".

**Update 2026-07-12:** per your call, the Apple and LinkedIn buttons are
removed from the sign-in screen until the providers are enabled.
`signInWithProvider` and `/auth/callback` still support them — re-adding is
just the two buttons in `Profile.jsx` (a comment there marks the spot).

### P2-B. 8 orphaned storage files — approve deletion

`property-images/9c47f15e-…/1783195…` (8 files, 2026-07-04) are referenced by
no listing — leaked by the old upload-then-insert flow (now fixed: submit
failures clean up after themselves). I don't delete data without your OK.
One-liner to remove them after you confirm, or delete the folder in
Dashboard → Storage.

### P2-C. AddSheet agent actions "viewing"/"open house" are half-wired

They navigate to `/new-listing?openHouse=0|1` — params the wizard ignores.
Open-house events need a product definition (separate table? a flag on
listings?) or the two actions should be removed from the sheet.

### P2-D. Saved-search alerts need infra

The bell toggle on `/saved-searches` writes `alerts_enabled`, but nothing
sends alerts. Needs: pg_cron (or scheduled Edge Function) matching new
listings against saved filters + an email provider. Say which provider and
I'll build the pipeline next pass.

### P2-E. Sort mixes rent and sale prices

"Price ↑" ranks a €650/month rental above a €95,000 sale. Correct per the
data model (one `price` column), debatable per UX. Options: force a listing
type before allowing price sort, or sort within type groups. Product call.

### P2-F. Seed listings carry the dummy phone 355691234567

The 8 seed rows have `contact_phone = '355691234567'` — the code no longer
invents this number (fixed pass 1), but the seed DATA still points WhatsApp
CTAs at a possibly-real number. Fine for dev; replace or null before launch.

---

# PASS 1 — 2026-07-02 (historical; §8 superseded — viewings + agent dashboard shipped in pass 2)

## 0. ANTHROPIC_API_KEY — one command to switch the AI features on

The three AI edge functions (`ai-generate-listing`, `ai-parse-search`,
`ai-listing-assistant`) are deployed and verified, but the Anthropic key is
not set (I don't create or handle secrets). Until you set it they return a
clean `503 ai_unavailable` and the UI falls back to the non-AI path. Enable:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref xzzzhlwmzotibrxdqmcm
```

(or Dashboard → Edge Functions → Secrets). No redeploy needed. The key never
touches the client bundle.

## 0b. Feature G (price insight) — flagged, NOT shipped

Per your constraint I did not build the price-estimate feature. Before it
ships you need to decide: (a) comparables source (same city + type + ±30% sqft
is my proposal), (b) minimum comparable count before showing anything (I'd say
5), (c) exact disclaimer copy in 8 languages, (d) whether agents can see it on
their own listings. The Zillow-style "estimate, not advice" framing from
CLAUDE.md applies. Say go and I'll build it behind `VITE_FLAG_PRICE_INSIGHT`.

## 0c. GOOGLE_TRANSLATE_KEY is INVALID — auto-translate is down

Verified live: `translate-property` returns 500 with Google's
"API key not valid". This breaks BOTH the new wizard translate button
(Feature E) and the pre-existing `translate-description` fallback. The app
degrades gracefully (stored `title_i18n` translations still display), but no
NEW translations can be produced until you replace the secret:

```bash
supabase secrets set GOOGLE_TRANSLATE_KEY=<valid key> --project-ref xzzzhlwmzotibrxdqmcm
```

Check `DEEPL_API_KEY` while you're there — it's untested because the pipeline
fails at the Google (sq→en) step first. I do not create or rotate keys.

## 0d. Test account created for verification (dev DB)

To verify authenticated flows end-to-end I created a confirmed test user
directly in GoTrue: `claude-test@shtepia.dev` / `TestPass!2026` (role: agent,
"FHO Test Agency") plus one test conversation with one message against the
Blloku listing. Delete the user in Dashboard → Authentication when done
(cascades the profile), or keep it as a QA account. Flagging because it's
your data, not mine.

## 1. Supabase project auto-pause (infra / billing)

The project was **paused (INACTIVE)** when I started — the whole backend was
down. I restored it (non-destructive). On the free tier it will pause again
after ~7 days of inactivity. Options:
- Upgrade the project to Pro, **or**
- accept that a dormant app goes down and needs a manual restore.

## 2. Apple Sign-In — configuration checklist (your consoles)

The web app now has an Apple button calling `signInWithProvider('apple')`.
Until you configure the provider it shows a clean "provider not configured"
error. To enable:

1. **Apple Developer console** (paid account required):
   - Create an **App ID** (e.g. `me.shtepia.app`) with "Sign In with Apple".
   - Create a **Services ID** (e.g. `me.shtepia.web`) — this is your web
     `client_id`. Enable "Sign In with Apple" on it.
   - Under the Services ID, set the **Return URL** to
     `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`.
   - Create a **Sign In with Apple key** (.p8 file), note Key ID + Team ID.
2. **Supabase Dashboard → Authentication → Providers → Apple**:
   - Enable, enter Services ID as Client ID, and generate/paste the client
     secret (Supabase generates it from Team ID + Key ID + .p8 contents).
3. No code changes required afterwards.

## 3. LinkedIn Sign-In — configuration checklist

Button calls `signInWithProvider('linkedin_oidc')` (the current provider id;
the old `linkedin` provider is deprecated).

1. **LinkedIn Developer portal** (https://developer.linkedin.com):
   - Create an app, request the **"Sign In with LinkedIn using OpenID
     Connect"** product.
   - Add redirect URL:
     `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`.
   - Copy Client ID + Client Secret.
2. **Supabase Dashboard → Authentication → Providers → LinkedIn (OIDC)**:
   - Enable and paste Client ID + Secret.
3. No code changes required afterwards.

## 4. Redirect URLs for production (all OAuth providers)

`Authentication → URL Configuration` currently must contain your dev origin
(`http://localhost:5173`) for Google to work locally. Before launch, add your
production domain to **Site URL / Redirect URLs**, or OAuth will bounce users
to localhost.

## 5. Draft listings skip validation (product decision)

"Save Draft" intentionally bypasses validation, so a draft can be saved with
no title (it becomes an empty-titled row). If you want minimum-viable drafts
(e.g. title required), say the word and I'll add it.

## 6. `properties` visibility policy (product decision, already tightened)

I changed the SELECT policy from "everyone sees every row (incl. drafts +
contact info)" to "everyone sees `active`; owners/agents see their own".
If you intended drafts to be publicly visible (e.g. for admin tooling),
this needs revisiting — but the old policy leaked contact phone/email of
unpublished listings.

## 7. Role vocabulary: `buyer` vs `client`

The DB default is `'buyer'`, the signup form writes `'client'`, and code
accepts both. Works, but pick one eventually and migrate the data
(1-line SQL) + the signup constant. I did **not** unify it because existing
rows may carry either value and it's a naming call.

## 8. Viewings & agent dashboard are unbuilt features

Schema for `viewings` exists (and now has RLS), but there is no booking UI —
"Request a viewing" just navigates to search. Agent dashboard is a
placeholder. Both need product definitions before building.

## 9. Test artifacts at repo root

`test-*.cjs` scripts and `test-*.png` screenshots at the root look like
one-off Puppeteer experiments. I left them untouched — delete or move to a
`scripts/` folder if unneeded.

## 10. Leaked-password protection (1-click dashboard toggle)

Supabase advisor: HaveIBeenPwned password screening is disabled. Enable it at
Dashboard → Authentication → Providers → Email → "Prevent use of leaked
passwords". Not something I can toggle via the API.

## 11. Hybrid repo (Expo app + Vite app)

`app/`, `components/`, `data/` etc. belong to the older Expo RN app;
`src/` is the live Vite web app. CLAUDE.md still documents only the Expo app.
Decide whether the Expo app is still a target; if not, extracting the web app
into its own repo (or deleting the Expo tree) would remove ~30 dependencies
and a lot of confusion. Not done — too destructive to decide unilaterally.

---

## ═══ MOBILE PARITY PASS — 2026-08-18 ═══

Two items from the design-handoff phase list were **not built**, because each
contradicted a decision already recorded in this repo.

**Both resolved by the owner on 2026-08-18: keep the price inputs as they are,
drop trending neighborhoods.** Neither is open any more; they're kept here so
the next person to read the handoff doesn't re-raise them as gaps.

### MP-A. Dual-thumb price slider (filter sheet)

The handoff asks for a dual-thumb range slider. Web's `Search.jsx` uses two
plain number inputs (`.range-inputs`), and mobile's filter sheet already
matches that. Building the slider on mobile only would put the two apps on
different controls for the same filter, against CLAUDE.md's "web is the design
source of truth".

**RESOLVED 2026-08-18 — no slider, on either app.** The number inputs stay.
They also express "min set, max unbounded" cleanly, which a two-thumb slider
can't without an extra "no max" affordance. The handoff item is closed, not
deferred.

### MP-B. "Trending neighborhoods" on Home

The handoff asks for this section on mobile. `Home.jsx:94` says it was
*removed from web per owner request on 2026-07-14*, with the CSS and i18n
keys deliberately retained "for easy restore". Adding it to mobile would
re-introduce something you killed three weeks earlier.

**RESOLVED 2026-08-18 — dropped for good, on both apps.** The 2026-07-14
removal stands and mobile never gets the section. Note the now-dead
`home.css` rules and `home.neighborhoods` i18n keys are still in the tree,
kept back when the removal was thought to be reversible; they're safe to
delete whenever someone is next in those files.

### Also worth knowing

- **`listing/new` is now the create entry point.** The tab-bar "+" and My
  Listings' "New Listing" pill both point at the wizard. `listing/create`
  (the single-scroll form) is untouched and still reachable by route — say
  the word once the wizard has taken a real submission and it can go.
- **Password reset on mobile completes on web.** `resetPassword` omits
  `redirectTo`, so Supabase uses the project Site URL. There is no in-app
  recovery screen and no deep link registered for one; adding those is the
  only way to keep the flow inside the app.

---

## ═══ GOOGLE OAUTH REDIRECT CONFIGURATION — 2026-08-18 ═══

Supersedes §4 above, which only covered localhost from before the production
Vercel deploy existed. App code is verified correct (unchanged since Pass 6/7
audits) — everything below is dashboard-only, in two consoles I don't have
access to. Live-verified via direct `curl` against Supabase's `/authorize`
endpoint: the Google provider is enabled, has a real `client_id`
(`1086087149243-ml0312i5dj6gjcjm6fpmops98pv17t24.apps.googleusercontent.com`),
and correctly forwards the fixed Supabase callback below to Google.

**The chain:** `App → Supabase /authorize → Google → Supabase /auth/v1/callback → app's /auth/callback`

### Google Cloud Console → your OAuth client → Authorized redirect URIs

Needs **exactly one** entry (this is Supabase's own fixed callback — the
same for every environment, not the app's URL):

```
https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback
```

Not the Vercel URL, not localhost, no trailing slash. If this is wrong,
Google rejects the request with `Error 400: redirect_uri_mismatch` before
your app is ever involved — the app's `/auth/callback` route is not the
cause of that error.

### Supabase Dashboard → Authentication → URL Configuration

**Redirect URLs** (allow-list) needs both:
```
http://localhost:5173/auth/callback
https://real-estate-app-my-self-f307.vercel.app/auth/callback
```

**Site URL** should be the production domain before launch:
```
https://real-estate-app-my-self-f307.vercel.app
```

These are exactly the values the code sends — confirmed by hitting
`/auth/v1/authorize?provider=google&redirect_to=...` directly for both the
localhost and production values; both are accepted at the initiate step.
Whether they're actually on this allow-list can only be confirmed by
completing a real sign-in (Supabase validates the allow-list on the final
redirect back, after Google's leg completes) — not something I can do
myself; I don't authenticate with real credentials, including for testing.

### Diagnosing which side is still wrong (if it still fails after the above)

Open the production site, click **Continue with Google**:
- `Error 400: redirect_uri_mismatch` → Google Cloud Console's redirect URI
  is still wrong.
- Reaches the Google account picker, then bounces back to the login page →
  Google Cloud is fine; Supabase's redirect allow-list is the remaining
  piece.
- Lands back in the app signed in → fixed.

### Mobile (Expo Go) uses a different redirect URI — not these two

Native `signInWithProvider` (`contexts/auth-context.tsx`) never sends the
web callback. It computes its own via `Linking.createURL('auth/callback')`
at runtime — `exp://192.168.0.8:8081/--/auth/callback` under Expo Go on this
LAN, or `shtepia-ime://auth/callback` in a real installed build — and
exchanges the code inline after the in-app browser session closes, with no
shared callback screen between platforms. Nothing to add to either dashboard
list above for this to work; it's a separate flow by design, already
verified correct in code.

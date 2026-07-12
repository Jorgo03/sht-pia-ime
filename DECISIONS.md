# DECISIONS.md — needs your input / your console access

Things I could not (or should not) resolve autonomously. Everything else in
AUDIT.md was fixed; see the final report for the change log.

---

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

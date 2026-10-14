# Bugs: Shtëpia.ime

Found by `/replica-test` on 2026-10-14. Every bug below was reproduced, either
in Chromium against a production build or by a failing unit test. Suspicions
that were not reproduced are under "To check" at the bottom.

Since c64b1e2 most of this is automated: `npm run test:e2e` (see
`test-plan.md`). BUG-012 to BUG-014 were found by that suite.

Test setup: web = Vite production build; mobile = `expo export -p web` of the
phone app (same code as the phone, rendered in a browser). Both were served
locally against a replayed copy of the 15 real listings from production, so
the test traffic never touched the live database. Viewport 375–390px, touch
enabled, plus a 1280px desktop pass. RLS was tested live, inside transactions
that were rolled back.

| ID | Sev | Title | Status |
| --- | --- | --- | --- |
| BUG-001 | S2 | Web: listings posted by an owner (no agent) show no way to contact anyone | fixed in ae5a93e |
| BUG-002 | S2 | Phone app: shared listing link points to a domain that does not exist | fixed in ae5a93e |
| BUG-003 | S3 | Web: WhatsApp link skips the number helper (`wa.me/+355…`, local numbers break) | fixed in ae5a93e |
| BUG-004 | S3 | Missing listing is a dead end (web and phone app) | fixed in ae5a93e |
| BUG-005 | S3 | Phone app: signed-out Messages has no sign-in button | fixed in ae5a93e |
| BUG-006 | S3 | Accessibility: unnamed buttons, buttons nested in clickable elements | partly fixed (see entry) |
| BUG-007 | S3 | WhatsApp helper puts +355 in front of foreign numbers | fixed in ae5a93e |
| BUG-008 | S4 | Light mode: several text colours fail contrast | open |
| BUG-009 | S4 | Phone app: listing images have no text alternative | open |
| BUG-010 | S4 | Web: Share on desktop copies the link silently | fixed in ae5a93e |
| BUG-011 | S3 | Call link invalid for an owner number typed as "+ 069…" | fixed in ae5a93e |
| BUG-012 | S3 | Show/hide password buttons have no accessible name (web and phone app) | fixed in c64b1e2 |
| BUG-013 | S4 | After a reload in another language the page still says it is Albanian | fixed in c64b1e2 |
| BUG-014 | S4 | Sign-in errors are not announced to screen readers | fixed in c64b1e2 |

---

### BUG-001: Web owner listings have no contact option

- Severity: S2
- Flow / case: F02 / F02-H2
- Screen: web `/property/:id`
- Build: c36fb99  Browser / device: Chromium, 390px, touch

Steps
1. Open a listing created by a client account, with no agent (3 of the 15 live
   listings, e.g. "Apartament 1+1 me qera Ali Demi").
2. Look for a way to contact the seller.

Expected: chat, call and WhatsApp, like an agent listing.
Actual: the whole contact block is wrapped in `{property.agent && …}`, so
nothing renders. The owner's phone is not shown anywhere on the page. The only
button is "Schedule a viewing".
Evidence: e2e run printed `owner listing buttons: [...]` with no contact entry
and `owner phone shown anywhere: NO`.
Status: fixed in ae5a93e. The contact strip renders for an agent or for an
owner phone. After the fix: `Bisedo`, `Thirr -> tel:+355692123456` and
`Mesazh -> https://wa.me/355692123456?...` (screenshot
`fix_owner_strip.png` in the test run).

### BUG-002: Phone app shares a link to a domain that does not exist

- Severity: S2
- Flow / case: F02 / F02-H4
- Screen: phone app, listing detail, share button
- Build: c36fb99

Steps
1. Open any listing in the phone app and tap Share.
2. Send it to someone.

Expected: a link that opens the listing.
Actual: the link was `https://shtepia.ime/property/<id>`. `.ime` is not a
top-level domain, so the link cannot open. On Android it is worse: React
Native's `Share.share` ignores `url` there, so the recipient gets only the
title.
Evidence: `app/property/[id].tsx:157` in c36fb99.
Status: fixed in ae5a93e. New `lib/site.ts` builds the link from
`EXPO_PUBLIC_SITE_URL`, which defaults to the live Vercel site. Android puts
the link inside the message.

### BUG-003: Web WhatsApp link bypasses the phone helper

- Severity: S3
- Flow / case: F02 / F02-H3
- Screen: web `/property/:id`, agent strip, "Message"
- Build: c36fb99

Steps
1. Open an agent listing and tap "Message".

Expected: `https://wa.me/355691234567?...`, the format wa.me documents.
Actual: `https://wa.me/+355691234567?...`, built by hand with only the spaces
removed. A local number such as `0692123456` would produce
`wa.me/0692123456`, which WhatsApp rejects. The phone app already used the
helper, so the two apps disagreed.
Evidence: earlier e2e run, `agent phone +355 69 123 4567 -> opened ["https://wa.me/+355691234567?..."]`.
Status: fixed in ae5a93e (web now calls `whatsappUrl()`).

### BUG-004: Missing listing is a dead end

- Severity: S3
- Flow / case: F02 / F02-N1
- Screen: web `/property/<unknown id>`, phone app `property/<unknown id>`
- Build: c36fb99

Steps
1. Open a listing URL whose listing was deleted, or a mistyped id.

Expected: a message saying the listing is gone, and a way to continue.
Actual: a single line "No properties found" and nothing else. In the phone app,
when it was opened from a link, there was no back stack either.
Evidence: screenshots `shot_property_..._dead.png` and `m_property_..._dead.png`.
Status: fixed in ae5a93e. Both apps now show "This listing is no longer
available", a hint, and Search / Home buttons. The new `detail.unavailable*`
keys are in all 8 locales.

### BUG-005: Phone app signed-out Messages has no sign-in button

- Severity: S3
- Flow / case: F05 / F05-N1
- Screen: phone app `/messages`
- Build: c36fb99

Steps
1. While signed out, open Messages.

Expected: a way to sign in.
Actual: the text "Sign in to see your messages" and a back arrow only.
Status: fixed in ae5a93e. A "Sign in" button opens the Profile tab, which is
where sign-in lives, the same as the favourites prompt.

### BUG-006: Accessibility, unnamed and nested interactive controls

- Severity: S3
- Flow / case: all screens, axe-core scan
- Build: c36fb99

Actual (axe-core):
- `button-name`: on narrow screens the web header language button has no
  accessible name, because its label is hidden.
- `nested-interactive`, web: the agent strip was a clickable `<section>` with
  buttons inside it.
- `nested-interactive`, web: cards (`PropertyCard`, `FeaturedCard`, `fav-row`)
  are `role="button"` with a heart button inside.
- `nested-interactive`, phone app (web export): property cards.

Status: partly fixed.
- Fixed in 074c17a and c64b1e2: the language button now has `aria-label` and
  `aria-expanded`, and the signed-out person icon now has a name.
- Fixed in ae5a93e: the agent strip is no longer clickable as a whole. Only the
  agent's name links to the profile, and axe now reports `[]` on the strip.
- Open: the cards. The fix is to make the card's title the link, stretched
  over the card with a pseudo-element, and keep the heart as a sibling. That
  touches every card variant, so it gets its own pass.

### BUG-007: WhatsApp helper adds +355 to foreign numbers

- Severity: S3
- Flow / case: F02 / F02-E4 (diaspora owner with an Italian or German phone)
- Build: c36fb99

Steps
1. Call `whatsappUrl('+39 333 123 4567', 'hi')`.

Expected: `wa.me/393331234567`
Actual: `wa.me/355393331234567`. Every number not already starting with 355
got 355 in front of it, and `0039…` became `355039…`. This breaks the
diaspora users the product is built for.
Evidence: `tests/phoneLinks.test.mjs`. The two foreign-number tests failed
before the fix and pass after it.
Status: fixed in ae5a93e in both `src/lib/format.js` and `lib/format.ts`.

### BUG-008: Light mode text contrast

- Severity: S4
- Screen: web, light theme, several screens
- Actual: axe `color-contrast` failures on muted and faint text and on some
  orange-on-cream labels, below 4.5:1.
- Status: open. The fix is a token change (`--fho-text-faint`, the orange text
  shade), and per CLAUDE.md it has to be mirrored in `constants/theme.ts`. It
  is a design-system decision, so it was left for a design pass.

### BUG-009: Phone app images have no text alternative

- Severity: S4
- Screen: phone app listing detail and cards, web export
- Actual: axe `image-alt` (7 to 15 per screen). `expo-image` images have no
  `accessibilityLabel`.
- Status: open. The fix is to pass the listing title as `accessibilityLabel`
  on card and gallery images.

### BUG-010: Web share on desktop gives no feedback

- Severity: S4
- Screen: web `/property/:id`, share button, browsers without `navigator.share`
- Actual: the link was copied to the clipboard with no confirmation, so it
  looked like the button did nothing.
- Status: fixed in ae5a93e. It now shows a "Link copied" toast (new
  `detail.linkCopied` key in 8 locales), and a clipboard failure is caught
  instead of becoming an unhandled rejection.

### BUG-011: Call link invalid for a number typed as "+ 069…"

- Severity: S3
- Flow / case: F02 / F02-E4
- Found while verifying BUG-001.

Steps
1. Open the live owner listing whose phone is stored as `+ 069 23 22 758`.
2. Tap Call.

Expected: `tel:+355692322758`
Actual: `tel:+0692322758`, which no phone can dial. The phone app had the same
bug in `handleCall`.
Status: fixed in ae5a93e. New `internationalPhone()` and `telUrl()` helpers in
both apps are shared by Call and WhatsApp. There is a test in
`tests/phoneLinks.test.mjs`.

### BUG-012: Show/hide password buttons have no name

- Severity: S3
- Screen: web `/profile` sign-in form and new-password form; phone app Profile
- Found by: `e2e/a11y.spec.ts` (axe `button-name` on `.field-eye`)

Steps
1. Open Profile while signed out and move a screen reader to the eye icon
   next to the password.

Expected: "Show password" (or "Hide password").
Actual: "button", with no name.
Status: fixed in c64b1e2. New `auth.showPassword` and `auth.hidePassword`
keys in all 8 locales. The web button also reports `aria-pressed`, and the
phone app's toggles have an `accessibilityLabel`.

### BUG-013: Page language not restored after a reload

- Severity: S4
- Screen: web, every page
- Found by: `e2e/settings.spec.ts`, F08-H1

Steps
1. Switch the site to English and reload.

Expected: `<html lang="en">`
Actual: `<html lang="sq">`. Only clicking a language set the attribute, so on
every later visit screen readers read English text with Albanian
pronunciation, and browsers offered to translate the page "from Albanian".
Status: fixed in c64b1e2. `src/i18n/index.js` sets it on every language
change, including the language restored on load.

### BUG-014: Sign-in errors are not announced

- Severity: S4
- Screen: web `/profile`, the email sign-in, magic-link and delete-account
  messages
- Found by: `e2e/access.spec.ts`, F04-N2

Steps
1. Sign in with a wrong password.

Expected: the error "Email ose fjalëkalim i gabuar." is shown and announced.
Actual: it was shown, but in a plain `div`, so a screen reader user heard
nothing.
Status: fixed in c64b1e2 with `role="status"`, and `role="alert"` for the
delete-account failure.

---

## To check (not reproduced as a user-visible bug)

- `messages` has no UPDATE policy, so `read_at` can never be set. Today the app
  never writes it, but a "mark as read" feature will fail until a narrow
  policy is added. This is a schema change, so it needs the owner's approval.
- There is no screen for editing your phone number or avatar. The column
  grants on `profiles` only allow `full_name`, `agency_name` and
  `preferred_language`. An agent's phone can only be set by an admin.
- React error #418 (hydration mismatch) appears in the phone app's **web
  export** only. The native app does not hydrate, so it is probably harmless.
- Data: "Apartament 1+1 me qera Ali Demi" says "me qera" (for rent) in its
  title but is stored as `listing_type = sale` at €150,000. This is a content
  problem, not a code problem. Its owner should fix it.
- The default Postgres `TRUNCATE` grants to `anon` and `authenticated` are
  still there. They cannot be reached through the Supabase API (PostgREST has
  no TRUNCATE), but revoking them is cleaner.
- `supabase/pending/plans_by_period_months.sql` still needs the owner's
  approval before it is applied.

# Launch checklist: Shtëpia.ime

Checked on 2026-10-14 against the code (commit 83a2cd6), the live Supabase
project `xzzzhlwmzotibrxdqmcm`, and Supabase's own docs. "You" means the
owner, because it needs an account, money, a decision or a login. "Claude"
means it can be done in code.

Tracker with tick boxes and the payment plan:
https://claude.ai/artifact/2iwP9xo9hG7x3vkAt8khbr (`replica/publish-plan.md`
has the same payment plan in text).

Status: **not ready to publish.** Nothing below is a broken feature. The
website works and CI is green. What stands in the way is accounts, setup and
store requirements.

---

## 1. Blockers: the app will not reach real users without these

### 1.1 Real people cannot receive sign-up emails (You, about 30 min)
Until a custom SMTP server is configured, Supabase only sends auth emails to
members of your Supabase team. Everyone else gets "Email address not
authorized". That covers sign-up codes, magic links and password resets. The
built-in sender is also limited to a few emails an hour. Google sign-in still
works, but email sign-up is broken for every real customer.
Source: https://supabase.com/docs/guides/auth/auth-smtp

- Create an account with an email service (Resend, Brevo, Postmark or AWS SES).
- Verify a domain you own with it (see 1.4).
- In the Supabase dashboard, open Authentication → Emails → SMTP Settings and
  enter the credentials. Turn link tracking off at the email service.

### 1.2 Move Supabase off the free plan (You, about $25 a month)
The project is on the **free** plan. Free projects are paused after 7 days of
low activity (this already happened once to this project), and their backups
cannot be downloaded. A paused database means a dead app for every user.
Upgrade the organization to Pro under Billing. This also unlocks leaked-password
protection (see 2.4).

### 1.3 Remove the demo data (You approve, Claude does it)
**Done 2026-10-16:** the 12 seed listings and the 2 `@mailinator.com` diagnostic
accounts were deleted; no favourites, viewings or chats were linked to them.
Still open: `claude-test@shtepia.dev` ("Agjent Test") and the seed account
`system@shtepia.ime` itself, kept until the owner decides. The rest of this
section is history.

12 of the 15 live listings are seed data under "Future Home Orange", with the
placeholder phone **+355 69 123 4567**. Real visitors would call or WhatsApp a
number that isn't yours. There are also 2 test accounts. Before launch:
- delete the 12 demo listings and the test accounts, or replace them with real
  listings;
- ask the owner to fix "Apartament 1+1 me qera Ali Demi", which says "for
  rent" in the title but is stored as a sale at €150,000.

This is a destructive database change, so it waits for your explicit "go".

### 1.4 A domain of your own (You, about €10–30 a year)
The site lives at `real-estate-app-hazel-seven.vercel.app`. A domain such as
`shtepiaime.al` or `shtepia-ime.com` is needed for:
- Google showing "Shtëpia.ime" on its sign-in screen (brand verification
  requires a verified domain);
- sending sign-up emails from your own address (1.1);
- share links and store listings looking trustworthy.

Afterwards:
1. Add the domain in Vercel.
2. Add it to the Supabase Auth URL configuration (Site URL and Redirect URLs).
3. Add it to Google Cloud's OAuth "Authorized domains".
4. Set `EXPO_PUBLIC_SITE_URL` to it (Claude can update the default).

### 1.5 Report and block, required for user-generated content (Claude, after you approve the schema)
**Done 2026-10-16:** migration `20261016181934_report_and_block` applied, and
both apps have "Report this listing" on the listing page and Report / Block /
Unblock in chat. Reports are reviewed in the Supabase dashboard (table
`content_reports`). The phone screens still need a try on a real device. The
rest of this section is history.

Users post listings and message each other, so both stores treat this as a
user-generated-content app. Apple's guideline 1.2 requires a way to **report**
objectionable content, a way to **block** abusive users, a way for you to act
on reports, and published contact details. Google Play has the same rule. The
app has none of these today. The work:
- a `reports` table (listing or user, reason, reporter) with RLS that lets
  anyone report and nobody else read it;
- a "Report" option on the listing page and in chat, in both apps;
- "Block user" in chat, which hides their messages;
- a simple way for you to review reports (a Supabase dashboard view is enough
  at launch).

This is a schema change, so Claude needs your approval first.
**Update 2026-10-15:** the database part is written,
`supabase/pending/report_and_block.sql`. It was tested against the live
database inside a transaction that was always undone: 18 of 18 checks passed
for Klient, Agjent and signed-out users, and nothing was left behind. It
waits for the owner's "go"; the app screens follow.

### 1.6 Real app icon and splash screen (You make the logo; Claude wires it in)
**Done 2026-10-15:** the owner chose logo "Dera" (an open door whose knob is
the dot in .ime), neon orange `#FF5F1F`. Masters and the usage guide are in
`assets/brand/`; `scripts/generate-brand-assets.mjs` draws every size from
them. iPhone gets a white icon in light mode and a black one in Dark Mode
(iOS 18+) plus a tinted one; Android has no dark-mode icon, so it stays
white, with a monochrome layer for themed icons. The rest of this section is
history.

**Earlier update:** a starter orange-house icon replaced Expo's placeholders in
5e31792. The owner is designing the real logo; when it arrives, change the mark
in `scripts/generate-brand-assets.mjs` and run it to redraw every size.
`assets/images/icon.png`, the Android icons and `splash-icon.png` are still
**Expo's template placeholders**: a blue chevron on a grid and grey circles.
Apple rejects placeholder art, and it is the first thing users see. Needed:
- a 1024×1024 icon with no transparency;
- an Android adaptive foreground and monochrome version;
- a splash logo.

The Android icon background `#E6F4FE` is also the template's blue.

### 1.7 Privacy link inside the phone app (DONE in 5e31792)
The phone app only shows Privacy / Terms when `EXPO_PUBLIC_PRIVACY_POLICY_URL`
is set, and it is not set, so the app has **no privacy link**. Both stores
require one. Point it at the website's `/privacy` and `/terms` pages.

### 1.8 A contact email (You)
`VITE_LEGAL_CONTACT_EMAIL` is empty, so the privacy policy names no mailbox.
The stores also require a support email and URL. Create something like
`info@<your-domain>`, set it in Vercel and redeploy.

### 1.9 Store developer accounts (You)
- **Apple Developer Program**, $99 a year. Without it there are no iOS builds
  and no TestFlight. Sign in with Apple also cannot work: it is in the code,
  but no user has ever signed in with Apple.
- **Google Play Console**, $25 once.
- Register both as an **organization** (the company is registered in Albania),
  which needs a free D-U-N-S number. A *personal* Google Play account created
  recently must run a closed test with at least 12 testers for 14 days before
  it can publish. An organization account skips that.

### 1.10 Android map key (You create it, Claude adds it)
Android builds draw maps with Google Maps, which needs an API key in
`app.json` (`android.config.googleMaps.apiKey`). Without it the map is blank
in the real Android app. It only works in Expo Go because Expo Go uses Expo's
own key. Create a key in Google Cloud, restricted to the Android app.

### 1.11 First real builds and a review account (You and Claude)
- Run `eas build --profile production` for iOS and Android, then test on
  TestFlight and Play internal testing. Expo Go is not what users install.
- Create a demo agent account with a few listings for Apple and Google
  reviewers, and give them its login in the review notes.
- Fill in the stores' privacy questionnaires: Apple's App Privacy section and
  Google's Data safety form. Data collected: email, name, phone, photos,
  messages, approximate usage. Processors: Supabase (EU), Vercel, Google
  sign-in, Anthropic for the AI features.
- Prepare the store listing: screenshots, description in Albanian and English,
  and the age rating questionnaire.

---

## 2. Fix before launch (not blockers, but you'll regret skipping them)

### 2.1 Website title and link previews (DONE in 5e31792)
The browser tab says **"Future Home Orange"**, not Shtëpia.ime. There is also
no meta description, and no Open Graph tags, so a link shared on WhatsApp or
Facebook shows no title, picture or text. There is no `robots.txt` or
`sitemap.xml` either. Duashpi.al wins on Google search, so the basics matter.

### 2.2 Check the website shows listings (You, 1 min)
Earlier, the phone app's Supabase key was broken by copy-pasting. The Vercel
site was never confirmed. Open the live site. If no listings appear, set
`VITE_SUPABASE_ANON_KEY` in Vercel and redeploy.

### 2.3 Error monitoring (Claude, after you choose; free tier is enough)
If the app crashes on someone's phone today, nobody finds out. Sentry (free
tier, with an official Expo integration) reports crashes from both apps.
Adding it means adding a library, so it needs your OK.

### 2.4 Supabase security advisor (Claude and You)
- Leaked-password protection is off. It is a Pro plan feature, so turn it on
  after 1.2.
- Two `SECURITY DEFINER` helper functions (`current_user_is_agent`,
  `buyer_has_open_wanted_home`) can be called while signed out. They return
  only true or false about the caller, so the risk is low, but anonymous
  callers don't need them and access can be revoked.

### 2.5 Open accessibility bugs (Claude)
These are in `replica/bugs.md`:
- BUG-006: cards are buttons with a heart button nested inside;
- BUG-008: light-mode text contrast is too low;
- BUG-009: phone-app photos have no description.

None blocks store review, but they are quick wins.

---

## 3. After launch (when you're ready to earn)

### 3.1 Payments
Posting is free (DECISIONS.md M1), so you can launch without payments. Still
open: prices, perks, provider (Paddle, or an Albanian bank's card gateway such
as raiAccept) and applying `supabase/pending/plans_by_period_months.sql`.

**Store rule:** promoting a listing is a digital service used inside the app.
If the iOS or Android app sells it, Apple and Google require their in-app
purchase, which takes a 15–30% cut. Keeping checkout on the **website only**
avoids that, but then the apps must not show "buy" buttons or links to the web
checkout. Decide this before building the paywall.

### 3.2 Agency admin, moderation tools and analytics
These are the planned roles in CLAUDE.md. None is needed on day one.

---

## Suggested order

1. **This week, money and accounts:** Supabase Pro (1.2), domain (1.4),
   email service (1.1), Apple and Google developer accounts (1.9, start the
   D-U-N-S request now because it can take days).
2. **Claude, in parallel:**
   - privacy link (1.7);
   - website title and previews (2.1);
   - report and block (1.5, after you approve the schema);
   - delete demo data (1.3, after your "go").
3. **Once the assets exist:** wire in the icon and splash (1.6), the map key
   (1.10) and the domain (1.4).
4. **Build and review:** EAS builds, TestFlight / internal test, review
   account, store listings (1.11), then submit.

# Shtëpia.ime: pre-purchase QA and purchase decisions (2026-11-06)

Evidence-based. "Tested" means a test ran and passed here; nothing below was
tried on a physical phone, a simulator or an emulator. The detailed audit
history is AUDIT.md (Passes 29–40 are the security, frontend and Expo Go work
this builds on).

## A. Executive summary

- **What works:** browsing, search, filters, listing pages, favourites,
  messaging, viewing requests, leads, the agent dashboard, listing create /
  edit / delete with photos, profiles, sign-in (email + password, email code,
  Google), password reset and change. Security holds under the live
  database's own rules: a real agent and a real client ran the full listing
  lifecycle and every forbidden action was refused.
- **Fixed today:** on the app's web build, four confirmations did nothing
  (delete a listing, block a user, the chat Report/Block menu, the "sign in
  first" prompt), because react-native-web's `Alert.alert` is an empty
  function. Phones were never affected.
- **What does not work yet:** the AI chat is parked (invalid Anthropic key);
  payments are built but switched off and not deployed; LinkedIn sign-in is
  configured but its last step (the Client Secret) has not been exercised.
- **Safe to keep testing:** yes. **Ready for public production:** not yet,
  see section F (Must fix before production) and H.
- **Buy now:** nothing is required for the current testing stage. See G.

## B. Test accounts

No accounts were created in the live project: it is production, and the
project rule is never to write to it. Both roles were tested instead:

| Role | How it was tested | Role verified | Status |
|---|---|---|---|
| Client (buyer) | An existing buyer account, acting inside a cancelled transaction (`supabase/tests/client_agent_lifecycle.sql`); fixture client in the browser suites | `profiles.role = 'buyer'`, not a moderator | PASS |
| Agent | An existing agent account, same method; fixture agent (`e2e/support/fixtures.ts` AGENT) | `profiles.role = 'agent'`, not a moderator | PASS |

The script picks the accounts itself and prints no ids, emails or tokens.
To get two accounts of your own to click around with: sign up twice in the
app (one as Klient, one as Agjent) with addresses you control. The role is
chosen at sign-up; the database only lets it change in the first 5 minutes.

## C. Test results

| Test | Client | Agent | Evidence | Status |
|---|---|---|---|---|
| Sign in / out, wrong password, email code, reset, change password, confirm-email | ✓ | ✓ | e2e X03, X05, X17, X18, X27, X30–X32; F4-N14 | PASS (browser) |
| Sign-in limit (5 per account per minute, growing delay) | ✓ | ✓ | tests/loginThrottle.test.mjs | PASS |
| Session survives reload | ✓ | ✓ | X07, X13 (settings and session after reload) | PASS (browser) |
| Browse, search, filters, Sale/Rent tabs | ✓ | – | X01, X02, X35, X38 | PASS (browser) |
| Favourites save; signed out asks to sign in | ✓ | – | X04, X29, X54 | PASS |
| Create listing with photos, draft, failed photo, retry without duplicate | – | ✓ | X20–X23 | PASS (browser) |
| Edit listing, remove a photo | – | ✓ | F09-H1, F09-H4 | PASS (website) |
| Delete listing (asks first) | – | ✓ | X53 (fails on the old code) | PASS (after fix) |
| Profile edit and photo replace | ✓ | ✓ | X25, X26 | PASS (browser) |
| Messaging, viewing request with date and time | ✓ | ✓ | X06, X42, X49 | PASS (browser) |
| Leads, dashboard | – | ✓ | X39, X40, X41 | PASS (browser) |
| Block / report menu on the web | ✓ | ✓ | X55 | PASS (after fix) |
| **Full lifecycle under live RLS:** agent creates → edits price/type/place/photos → publishes; client sees it, favourites it, messages, books a viewing; agent receives the message, confirms; agent deletes; client no longer sees it, favourite gone | ✓ | ✓ | client_agent_lifecycle.sql, 17/17 OK | PASS (live database) |
| Forbidden: edit / delete another agent's listing, client edits agent's listing, client confirms own viewing, read others' favourites, negative price | ✓ | ✓ | same script | PASS (all refused) |
| Users see only their own data (buyer, agent, visitor) | ✓ | ✓ | supabase/tests/rls_isolation.sql | PASS (live) |
| Admin actions, prices, fake payments refused | ✓ | ✓ | supabase/tests/admin_and_prices.sql | PASS (live) |
| Bad form data refused by the server | ✓ | ✓ | Pass 33 trial: 11 bad entries refused | PASS (live) |
| iPhone / Android bundles build and load from the dev server | – | – | Pass 40: Hermes builds, manifests and bundles HTTP 200 | PASS (bundles) |
| Opened in Expo Go on a phone | | | | NOT TESTED |
| Google sign-in on a phone | | | earlier owner tests (Samsung A23) | NOT TESTED here |
| LinkedIn sign-in completed | | | request accepted by LinkedIn; no completed sign-in yet | BLOCKED (needs one real sign-in) |
| AI assistant | | | key rejected (401); chat parked | BLOCKED |
| Payments | | | built, off, not deployed | NOT TESTED |
| Push notifications | | | need a real device | NOT TESTED |

## D. Bugs found and fixed (this QA round)

| Bug | Severity | Root cause | Fix | Retest |
|---|---|---|---|---|
| Delete listing, block user, chat menu and sign-in prompt did nothing on the app's web build | Medium (web build only, not yet the public site) | react-native-web's `Alert.alert` is empty | `lib/confirm.ts`; web menu in chat | X53–X55 pass; X53 fails on old code |

Earlier rounds (AUDIT.md Passes 29–40) fixed, among others: missing server
checks on every form (34 rules), unescaped website map markers, debug output
in production, sign-in rate limit, upload naming, HTTPS headers, 16 packages
out of step with Expo Go, uneven sign-in buttons.

## E. Changes in this round

- `lib/confirm.ts` (new): confirmation that works on phones and the web.
- `app/my-listings/index.tsx`, `app/messages/[id].tsx`, `app/property/[id].tsx`: use it; chat gets a web menu.
- `e2e/support/backend.ts`: the test backend handles listing deletes.
- `e2e-expo/flows.spec.ts`: X53–X55.
- `supabase/tests/client_agent_lifecycle.sql` (new): the live two-role lifecycle test.
- No database, RLS or auth configuration was changed in this round.

## F. What to change

**Must fix before testing:** nothing.

**Must fix before production**
1. Supabase Pro: free projects pause after a week of inactivity and have no automatic backups (G).
2. Vercel Pro once the site earns money: Hobby is for non-commercial use only (G).
3. A domain of your own: for the website, the sign-in screens and store listings (G).
4. Sign-in emails to the public: confirm in Supabase (Authentication → SMTP) that custom SMTP is set; the built-in mailer only sends to the project's own team and has a low hourly limit. Not readable from here.
5. Legal: privacy policy and terms exist; have a lawyer review them for Albania / the EU (GDPR) before launch.
6. Real-phone test of the main journeys in Expo Go (section H).

**Recommended:** replace the Anthropic key and bring the AI chat back; finish one LinkedIn sign-in; leaked-password protection (needs Pro); card thumbnails (needs Pro).

**Optional:** remove web-only route code from the phone bundles before store submission.

**Not necessary:** CSRF tokens or SameSite cookies (no cookie sessions); a `DEBUG` flag (nothing reads one); more server capacity (usage is ~3% of the free limits).

## G. Purchase decisions

Prices and limits read from the official pages on 2026-11-06.

| Service | Needed for testing now? | Needed for launch? | If you don't buy it | Recommendation |
|---|---|---|---|---|
| **Custom domain** (~€10–15/year at a registrar) | No: the site works on `real-estate-app-hazel-seven.vercel.app` | Yes: your name on sign-in screens, store listings, trust, email sender | Users see a vercel.app address and `…supabase.co` on Google's sign-in | **BUY BEFORE PRODUCTION** (cheap; buy whenever you have settled the name) |
| **Apple Developer** ($99/year) | No: Expo Go on an iPhone is free | Yes, for TestFlight and the App Store | No TestFlight, no App Store, no native Apple Sign-In test | **BUY BEFORE PRODUCTION** (when you want TestFlight testers) |
| **Google Play Console** ($25 once) | No: Expo Go and EAS-built APKs install without it | Yes; new personal accounts must run a closed test with 12 testers for 14 straight days before production | No Play Store release | **BUY BEFORE PRODUCTION**, but at least a month before launch because of the 14-day test |
| **Supabase Pro** ($25/month; custom domain +$10/month) | No: usage is 16 MB database, 11.6 MB storage, 16 accounts (limits 500 MB, 1 GB, 50,000 MAU) | Yes, for reliability, not capacity: Free pauses after a week of inactivity and has no automatic backups | A quiet week takes the live app offline; no backups | **BUY BEFORE PRODUCTION** |
| **Vercel Pro** ($20/month per developer seat) | No | Yes once the site is commercial: Hobby is "non-commercial, personal use only" | The site would break Vercel's Hobby terms once it sells promotions or plans | **BUY BEFORE PRODUCTION** (when monetisation starts) |

Nothing here is a reason to buy today.

## H. Remaining blockers

| What | Why | Needs | Can you continue without it? | Paid? | Next step |
|---|---|---|---|---|---|
| Real-phone check | No device here | You, with Expo Go | Yes | No | `npm start`, scan, walk through sign-in, browse, favourite, message, create a listing |
| LinkedIn last step | The Client Secret is only used after a real sign-in | One LinkedIn sign-in by you | Yes | No | Sign in once with LinkedIn |
| AI chat | Anthropic key rejected | A new key | Yes (parked) | Anthropic usage | When you want it back |
| Store release | Accounts not bought | Apple + Google accounts | Yes | Yes | G |
| Public email | SMTP not verifiable here | Your Supabase dashboard | Yes, for testing | Possibly (email provider) | Check Authentication → SMTP |
| Payments | Off by design | Paysera project, prices, decision M2 (DECISIONS.md) | Yes | Provider fees | When you decide to sell |

## I. Scores (0–100), with evidence

| Area | Score | Why |
|---|---|---|
| Client experience | 80 | All client journeys pass in browser tests and live RLS; not yet seen on a phone |
| Agent experience | 82 | Create/edit/delete/photos/leads/dashboard pass; delete was broken on the web build until today |
| Authentication | 85 | Real Supabase Auth, bcrypt, rate limit, reset links 15 min; LinkedIn last step and phone sign-in untested |
| Database and security | 92 | RLS, triggers and 34 server form rules verified live; 17/17 lifecycle; admin and prices locked |
| Web application | 85 | Builds, 241 + app tests pass; production mode, HTTPS headers live |
| Expo Go compatibility | 80 | SDK-aligned, doctor 20/20, bundles load; no phone scan yet |
| iOS readiness | 55 | Bundle builds; no developer account, no TestFlight, Apple Sign-In unverified |
| Android readiness | 55 | Bundle builds; no Play account, 14-day closed test not started |
| Performance | 70 | 794 KB first load; full-size photos until Pro thumbnails |
| Automated testing | 85 | ~415 unit, ~405 browser tests, 4 live-database scripts; no device tests |
| Production readiness | 60 | Blocked by plan choices (pausing, backups, commercial terms), store accounts, SMTP check, legal review |

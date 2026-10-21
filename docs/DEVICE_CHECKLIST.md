# Device checklist — Shtëpia.ime (replacement)

**This is a replacement, written 2026-10-21 from the app as it is in the
repository.** The tracker's "Before publishing → section 3" referred to 20
phone checks, but they were not in the tracker export or anywhere in the
repository, so these were derived from the actual screens and flows. They are
not the original 20.

Run every check on a **signed build installed from TestFlight (iPhone) and
from the Play internal or closed test track (Android)**, not in Expo Go: Sign
in with Apple, push notifications and the Android map only work in a real
build. Use two fresh test accounts (one Klient, one Agjent), never a real
customer's.

Record each result as PASS / FAIL with the phone model and OS version.
"Done here" says what was already checked without a phone; that never
replaces the device check.

| # | Check | Steps | Expected | Done here (no device) |
| --- | --- | --- | --- | --- |
| D1 | First launch | Install, open | Splash, then Home with real listings; no red screen; Albanian (or the phone's language if supported) | Expo export builds; e2e on the website |
| D2 | Safe areas | Open Home, a listing, Messages, Profile on a phone with a notch / Dynamic Island and on a small phone (≤ 5.5") | Nothing under the status bar or home indicator; floating tab bar clear of content; "+" fully tappable | Phone web export screenshots only |
| D3 | Email sign-up | Profile → Sign up, Klient, real inbox | 6-digit code arrives (needs the SMTP sender, L15); typing it signs you in | Flow tested in e2e with a simulated server (F4) |
| D4 | Password reset by code | Profile → Forgot? → enter the emailed code → new password | Alert "password updated"; sign out and back in with the new password | Code path type-checks; not run |
| D5 | Google sign-in | Profile → Continue with Google | Browser sheet shows "Shtëpia.ime" as the app name (F9 branding), returns signed in | — |
| D6 | Sign in with Apple (iPhone) | Profile → Continue with Apple, first time and again after deleting the account | Signs in; the first time, your name appears on Profile; cancelling the sheet shows no error | Nonce, name and cancel logic unit-tested (F8) |
| D7 | Session restore | Sign in, force-quit, reopen offline then online | Still signed in; offline shows a retry state, not a crash | — |
| D8 | Search and filters | Explore → city, zone, price, reference number | Results narrow correctly; clearing the city clears the zone; reference finds exactly one listing | e2e F19 on the website; phone filter code type-checks |
| D9 | Map (Android) | Explore → map | Google map tiles render (needs the Maps key, F9); pins open listings | Key wiring checked with `expo prebuild` |
| D10 | Map (iPhone) | Explore → map | Apple map renders; pins open listings | — |
| D11 | Listing detail | Open a listing; swipe photos; call; WhatsApp | Photos load; call and WhatsApp open with the listing's number and name | e2e F02 on the website |
| D12 | Favourites | Heart a listing signed out, then signed in | Signed out asks you to sign in; signed in it appears in Favourites after a restart | e2e on the website |
| D13 | New listing with photos | Agjent → "+" → fill the wizard → add 3 photos and a video | Upload progress; listing appears in My Listings; a non-image file is refused before upload | Upload checks unit-tested |
| D14 | Edit listing / mark sold | My Listings → edit → remove a photo → save; then mark sold | Changes saved; the removed photo is gone; sold listing leaves search | e2e F09 on the website |
| D15 | Profile photo and phone | Profile → Edit → choose photo, change phone | New photo shows after restart; a bad phone number is refused | e2e F12 on the website; live RLS 7/7 and 9/9 |
| D16 | Messages | Klient messages an Agjent's listing; Agjent replies | Both see the thread in real time; unread badge on the tab bar clears when opened | — |
| D17 | Push notifications | Profile → Notifications → allow; have the other account send a message and request a viewing with the app closed | A notification arrives for each; tapping opens the right chat / viewing; turning a type off stops it | Token and preference rules live-tested 11/11; sending needs `PUSH_DISPATCH_ENABLED` (F14) |
| D18 | Report and block | Report a listing; in a chat, block the other person, then have them send a message | Report confirms; the blocked person's message is refused | Live RLS 18/18; e2e F10 on the website |
| D19 | Delete account | Profile → Delete account → confirm | Signed out; signing in again with that account fails | Edge Function exists; not run on a device |
| D20 | Accessibility | Turn on VoiceOver / TalkBack; move through Home, a listing, the tab bar, the code boxes; also set the largest text size | Every control has a name; the tab bar reads as four tabs plus "New listing"; code boxes read "Digit 1 of 6"…; text does not clip | axe on the phone web export: no tab-bar or label violations (F16) |
| D21 | Dark mode | Switch the phone to dark mode | All screens readable; no white flashes | axe both themes on the website |
| D22 | Deep links | Open a shared listing link and a saved-search unsubscribe link | Listing opens in the app (or the website); unsubscribe page confirms | — |

D21 and D22 go beyond the tracker's count of 20; keep them.

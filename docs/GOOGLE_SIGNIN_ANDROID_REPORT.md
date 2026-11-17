# Android Google sign-in ended on the website: report, 2026-11-08

## Symptom

On a Samsung Android phone, "Continue with Google" opened Google and signed
in, but the browser then stayed on the Vercel website instead of returning
to the app.

## Root cause (from Supabase's auth log, read-only)

The failing attempt, 2026-11-07 23:10:36 UTC, asked Supabase to return to:

```
https://real-estate-app-hazel-seven.vercel.app/auth/callback?rt=shtepia-ime://auth/callback
```

- The `/auth/callback?rt=…` relay is used only when the app runs in **Expo
  Go**. Expo Go's own address cannot be put on Supabase's allow-list, so
  Google returns to the website, which forwards the code to the address in
  `rt` (`src/lib/oauthRelay.js`).
- `rt` held `shtepia-ime://auth/callback`, the address of a **dev or store
  build**. Expo Go does not own that scheme, so the website forwarded the
  code to an address nothing on the phone answers, and the browser stayed
  on Vercel.
- Why: `makeRedirectUri()` (expo-auth-session) builds the address through
  expo-linking, which decides "Expo Go or not" from
  `Constants.executionEnvironment`. On this Samsung in Expo Go (SDK 58) that
  value does not report Expo Go (seen before on a Samsung A23, see the
  `IS_EXPO_GO` comment in `contexts/auth-context.tsx`). So it chose the app's
  own scheme. `isRunningInExpoGo()` was right, so the relay was still taken,
  with the wrong return address inside it.
- The successful sign-ins in the same log carried
  `exp://192.168.0.8:8081/--/auth/callback` (home Wi-Fi) or
  `exps://c-jorgo03-….on.expo.app/--/auth/callback` (tunnel).

This is not a Supabase or Google configuration problem. Google's redirect
stays Supabase's own `/auth/v1/callback`, as it should.

## Fix

| File | Change |
|---|---|
| `src/lib/oauthRelay.js` (+ `.d.ts`) | `expoGoCallback(origin)`: Expo Go's return address from the address it loaded the app's code from: `http://host:port` gives `exp://host:port/--/auth/callback`, `https://tunnel` gives `exps://tunnel/--/auth/callback`, anything else `null`. |
| `contexts/auth-context.tsx` | In Expo Go the return address now comes from `expoGoCallback(getBundleOrigin())`. `getBundleOrigin` is the helper expo-linking and expo-asset use themselves, and it is the address Expo Go really reached. A `makeRedirectUri()` answer is used only if it is already `exp://`/`exps://`. If the address could not receive the code from the website relay, sign-in is refused up front with an error, instead of ending signed in on the website. Dev and store builds are unchanged: they return straight to `shtepia-ime://auth/callback`, no website involved. Website sign-in is unchanged (its own branch). |
| `tests/oauthRelay.test.mjs` | New case: home Wi-Fi and tunnel addresses, both accepted by the relay; bad or missing origins give `null`. |

Unchanged: cancel still returns silently, the code is still exchanged once
(PKCE `exchangeCodeForSession`), the session is still stored by the Supabase
client (AsyncStorage), and roles and dashboards follow the profile as before.

## Second cause, found after the first fix (2026-11-08)

The owner tried again and still ended on the Vercel page. Supabase's log for
those attempts (23:20 UTC) shows the **right** address this time,
`rt=exp://192.168.0.8:8081/--/auth/callback`, but no code exchange from the
phone followed. So the website received the code and did not get it back to
Expo Go.

Why: the website handed the code on with a script after the page loaded.
Android's Chrome refuses a script that opens an app link without a tap, so
on Android the page showed an "Open the app" button and waited (a known
limit, noted in `index.html` since 2026-10-25). That page is the Vercel page
the owner saw.

Fix: `/auth/callback?rt=…` is now rewritten (`vercel.json`) to a Vercel
function, `api/auth-relay.js`, which answers with a **302 redirect** to the
app address. A redirect continues the chain that began with the tap on the
Google account, and Chrome lets that chain open the app. This is how Expo's
old sign-in proxy returned to `exp://`. The function uses the same
allow-list as the page (`buildRelayTarget` in `src/lib/oauthRelay.js`).
Any other address goes back to the page without `rt`, so the code never
leaves for an address that isn't allowed. The page and its button stay as
the fallback. Unit tests: `tests/authRelayFunction.test.mjs` (3).

## Account chooser every time (2026-11-08)

**Why Google picked an account by itself:** no prompt was sent, so Google
followed its default. When one Google account is already signed in on the
phone or in the browser and has used the app before, Google signs in with
it and shows no chooser.

**Change:** every Google sign-in now sends `prompt=select_account` (only
that: not `prompt=consent`, which forced the permission screen and could
hang, and not `access_type=offline`). One shared helper,
`src/features/auth/lib/oauthOptions.js`, used by the three Google sign-in
calls: the phone app, the app's web build (`contexts/auth-context.tsx`) and
the website (`src/features/auth/AuthContext.jsx`). The return path, deep
links and session handling are unchanged. Choosing an account does not
change who it is: Supabase matches the Google identity to the same user, so
no duplicate account.

**Supabase / Google Cloud:** no change. Checked live: asking Supabase's
`/authorize` for Google with `prompt=select_account` produces a Google
address that carries `prompt=select_account`, with Google returning to
Supabase's own `/auth/v1/callback` as before.

**Tests:** unit `tests/oauthOptions.test.mjs` (3: Google gets only
`select_account`, other providers nothing, every Google call in both apps
passes it and none asks for consent or offline access). Website e2e
**F4-N16** (tapping Google opens `/authorize` with `provider=google`,
`prompt=select_account`, no `access_type`, the usual `redirect_to`), phone
and desktop. Full website auth suite 68/68. **Not tested** (no device, no
real Google account here): the chooser itself with one or several accounts,
picking a different account, cancelling the chooser, sign-out and sign-in
again, Android return to the app, iOS.

## Configuration

- **Expo config:** none. The scheme `shtepia-ime` is already in `app.json`;
  CNG writes the Android intent filter for it at build time.
- **Supabase:** none for Expo Go. For a dev or store build,
  `shtepia-ime://auth/callback` must be in Authentication → URL
  Configuration → Redirect URLs (an earlier pass recorded it as honoured;
  the live settings cannot be read with the tools here).
- **Google Cloud:** none.
- **Vercel:** no dashboard setting. The new function (`api/auth-relay.js`)
  and the rewrite in `vercel.json` deploy with the website on a push to
  `master`.

## Tests

| Test | Result |
|---|---|
| Unit `npm test` (incl. the new relay case) | 434/434 passed |
| `tsc --noEmit`, ESLint on changed files | clean |
| `expo export -p android` | compiles to Hermes; the new code is in the bundle |
| `expo export -p web` | compiles |
| Supabase auth log read | root cause confirmed (above) |
| Google sign-in on a real Android phone in Expo Go | **NOT TESTED** (no device here). This is the check that proves the fix: sign in with Google and expect to land back in the app, signed in |
| Session after restarting the app; cancel; failure message; iOS | **NOT TESTED** on a device; code paths unchanged |
| Website Google sign-in | not re-run; its code is untouched |

Accounts: the failing attempt created the Google account it signed in with
(Supabase `user_signedup`). Signing in again with the same Google account
uses the same user; no duplicate is created.

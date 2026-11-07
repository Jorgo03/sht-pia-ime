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

## Configuration

- **Expo config:** none. The scheme `shtepia-ime` is already in `app.json`;
  CNG writes the Android intent filter for it at build time.
- **Supabase:** none for Expo Go. For a dev or store build,
  `shtepia-ime://auth/callback` must be in Authentication → URL
  Configuration → Redirect URLs (an earlier pass recorded it as honoured;
  the live settings cannot be read with the tools here).
- **Google Cloud:** none.
- **Vercel:** none. The website's relay page is unchanged.

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

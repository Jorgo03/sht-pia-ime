# Codebase audit — 2026-11-17

Whole repository, Expo app (the website and the phone apps), Edge Functions,
Vercel functions, build scripts and recent migrations. Legacy Vite `src/`
pages are not deployed (DECISIONS.md W6) and were only checked where the
Expo app imports them.

## Baseline (before)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 36 warnings |
| `npm test` | 633 / 633 |
| `npm run test:e2e:expo` | 436 passed, 2 failed (audit false positive) |

Sound on inspection: no secrets committed (only `.env.example`), RLS on every
recent table, `search_path` pinned on every SECURITY DEFINER function, the
OAuth relay allows only known redirect targets, every navigation inside an
effect is one-shot guarded, no hardcoded UI text, `dangerouslySetInnerHTML`
only with constants, upload type/size checked before upload on the web.

## Fixed

### Security
| Issue | Root cause | Files |
|---|---|---|
| `$&`, `$'` in a listing's title/description corrupted its pre-rendered page | User text passed as a `String.replace` replacement string, where `$` patterns are special | `scripts/expo-web/seo.mjs` (function replacements), `tests/expoWebSeo.test.mjs` |
| AI rate limits could be beaten with parallel requests | Count and insert were two separate calls | new `supabase/migrations/20261117200000_ai_take_quota.sql`; `rateLimit` in `ai-assistant`, `ai-listing-assistant`, `ai-parse-search`, `translate-property` |
| Signed-out callers could pick a fresh rate-limit bucket | IP taken from the client-controlled left-most `x-forwarded-for` entry | same four functions (`cf-connecting-ip`, else the right-most hop) |
| Daily AI cap allowed one call too many | `<=` instead of `<` | same four functions |
| Large tour video could skip the size limit on Android | Picker often reports no size; nothing re-checked | `lib/upload.ts`, `app/listing/new.tsx` (real bytes checked before upload) |
| Malformed AI requests answered "AI unavailable" (503); prompt text in logs | No own `try` around `req.json()`; no id/language validation; upstream bodies logged | `ai-listing-assistant`, `ai-parse-search` |

### Correctness
| Issue | Root cause | Files |
|---|---|---|
| Agent dashboard showed zeros instead of the retry state when a read failed | Supabase returns errors, it does not throw; results were not checked | `app/agent-dashboard/index.tsx` |
| A network blip on the profile read looked like "no profile" (agent tools hidden) | Read errors became `null` | `contexts/auth-context.tsx` (`maybeSingle`, keep the last profile on failure) |
| Viewing-request errors and success never shown on the website | `Alert.alert` is empty on react-native-web | `lib/confirm.ts` (`notify`), `app/property/[id].tsx` |
| Call / WhatsApp / maps / mail / settings links threw unhandled rejections on devices that cannot open them | `Linking` promises not caught | `app/property/[id].tsx`, `app/(tabs)/profile.tsx`, `components/legal/legal-document.tsx`, `components/profile/notifications-sheet.tsx` |
| Open chat dropped and re-opened its realtime channel on every token refresh | Effect depended on the `user` object, replaced hourly | `app/messages/[id].tsx` (depends on the id) |

### Performance
| Issue | Root cause | Files |
|---|---|---|
| Unread badge read every conversation | No filter | `hooks/use-unread-messages.ts` (only rows with unread, limit 1000) |
| Favourites, viewings read without a bound | No `.limit` | `contexts/favorites-context.tsx` (500), `app/viewings/index.tsx` (past year, 500) |
| Agent dashboard sent every listing id in one URL | Single `in()` list | `app/agent-dashboard/index.tsx` (batches of 150) |

### Hygiene
Duplicate import (`app/property/[id].tsx`); `any` on the amenity icon and the
favourites row; two dev-only `console.*` calls moved to `lib/debug`; unused
`GRADIENTS` removed (`lib/format.ts`); the one intended `require` documented
(`lib/supabase.ts`). Test tooling: the responsive audit no longer counts
controls hidden under a dialog as overlapping (`e2e-expo/site-audit.spec.ts`).

## After

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 34 warnings (below) |
| `npm test` | 634 / 634 |
| `npm run test:e2e:expo` | see the deployment note in the final message |

## Not fixed, and why

- **15 "setState inside an effect" lint warnings in the Expo app** (agent
  dashboard, leads, listing statistics, my listings, notifications, saved
  searches, viewings, road field, notification invite, listing assistant,
  favourites/notifications contexts, colour scheme). Each is a screen's
  load-on-open; behaviour is correct. The right fix is moving these screens
  to TanStack Query (already used by `app/wanted.tsx`) — a 15-file refactor,
  proposed as its own task. The other 19 warnings are in legacy `src/`.
- **Edge Function changes are not live yet.** The migration must be applied
  first, then the four functions deployed; deploying the functions first
  would make every AI call fail closed. Both change the live backend and wait
  for the owner's yes.
- Not changed on purpose: `CORS *` (Bearer auth, no cookies), the
  `push-dispatch` count reads, Leaflet's untyped objects.

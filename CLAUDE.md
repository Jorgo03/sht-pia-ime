# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Start Expo dev server
npm run web            # Start web dev server
npm run ios            # Start iOS simulator
npm run android        # Start Android emulator
npm run lint           # ESLint via expo lint
npx tsc --noEmit       # Type-check without emitting
npx expo install <pkg> # Install Expo-compatible package versions
```

No test framework is configured.

## Architecture

**Shtëpia.ime** — a cross-platform (iOS/Android/web) real estate app built with Expo SDK 54, React Native 0.81, and TypeScript in strict mode.

### Routing

File-based routing via Expo Router with typed routes enabled. The app shell is a 4-tab bottom navigator:

- `app/(tabs)/index.tsx` — Home (featured + recent properties)
- `app/(tabs)/explore.tsx` — Search/filter all listings
- `app/(tabs)/favorites.tsx` — Saved properties
- `app/(tabs)/profile.tsx` — Auth forms (when logged out) or user profile (when logged in)
- `app/property/[id].tsx` — Property detail screen (modal-style push)

### State Management

Context API with two providers wrapped at `app/_layout.tsx`:

- **AuthProvider** (`contexts/auth-context.tsx`) — session, user, signUp/signIn/signInWithProvider/signOut. OAuth uses PKCE flow on native (via `expo-web-browser`) and implicit flow on web. Apple Sign In uses native `expo-apple-authentication` on iOS.
- **FavoritesProvider** (`contexts/favorites-context.tsx`) — favorite IDs as a Set, cached Property objects, optimistic toggle with Supabase persistence.

### Data Layer

All data goes through Supabase directly (no API abstraction layer):

- `lib/supabase.ts` — client init with platform-aware storage (AsyncStorage on native, localStorage on web)
- `data/properties.ts` — `getProperties()`, `getPropertyById(id)`, `getFeaturedProperty()`
- `data/favorites.ts` — `getFavorites(userId)`, `addFavorite()`, `removeFavorite()`, `isFavorite()`
- `data/types.ts` — `Property`, `Favorite`, `Profile` interfaces

Supabase tables: `properties`, `favorites`, `profiles` (extends `auth.users`).

### Design System

Dark glassmorphic theme defined in `constants/theme.ts`:

- `AtticoColors` — primary palette. Key values: `primary: #0A0A0A`, `accent: #FF6B00` (orange), `glass/glassBorder` for translucent surfaces.
- All screens wrap content in `GradientBackground` component with `SafeAreaView`.
- Reusable components in `components/ui/` (ActionButton, SearchHeader, FilterTabs, GradientBackground) and `components/property/` (PropertyCard, FeaturedPropertyCard).

### Auth Flow (OAuth)

The `signInWithProvider` function in `contexts/auth-context.tsx` has three code paths:

1. **iOS + Apple** → native `expo-apple-authentication` → `signInWithIdToken`
2. **Native (other providers)** → `signInWithOAuth` with `skipBrowserRedirect: true` → `WebBrowser.openAuthSessionAsync` → `exchangeCodeForSession(code)`
3. **Web** → standard `signInWithOAuth` redirect, parsed by Supabase via `detectSessionInUrl: true`

Deep link scheme is `shtepia-ime` (configured in `app.json`). The redirect URL on native is `Linking.createURL('auth/callback')`.

### Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=<supabase project url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
```

### Path Alias

`@/*` maps to project root (configured in `tsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.

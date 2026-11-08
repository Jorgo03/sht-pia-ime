# Usability review for people of every age: 2026-11-08

Goal: someone who is not comfortable with phones can open the app and work
out the main features alone. The Expo app (iOS, Android and its web build) was
reviewed. The Vite website gets bug fixes only, so it received only the shared
wording changes.

**How it was checked.** Rendered screens at phone width, signed out and
signed in (17 pages): every control's size, name and visible text, and every
text size; then the first-time journey read from screenshots. Rendering was
in a browser. **No phone was used and no older person tried it.** Touch
targets on phones can be larger than a browser shows, because browsers ignore
React Native's `hitSlop`; that was taken into account below.

## What was wrong and what changed

| # | Problem found | Change | File |
|---|---|---|---|
| 1 | The bottom menu was icons only. A first-time user had to guess | A word under every icon (Kreu, Kërko, Mesazhe, Profili) and under + (Shto). The current tab is also bolder, so it is not shown by colour alone | `components/liquid-tab-bar.tsx` |
| 2 | My Listings: six unlabelled 30×30 icons per listing, 38 pt touch area at most | Each is a picture and a word (Shiko, Ndrysho, Statistika, Pauzë, Shitur or Me qira, Fshi), at least 64×52 | `app/my-listings/index.tsx` |
| 3 | Saved searches and wanted-home posts were deleted on one tap | Asks first, like listings and leads. Buttons 44×44 | `app/saved-searches/index.tsx` |
| 4 | 52 text styles at 10–11 pt: card details, labels, prices per m² | Minimum 12. Exceptions: map marker bubbles and the unread count, which have fixed-size circles | 26 files |
| 5 | Sign-in and sign-up: faint text on the orange end of the gradient (automated contrast checks cannot read gradients) | Placeholders, icons, hints and links made much lighter. "Regjistrohu" and the forgot-password link are white and underlined | `app/(tabs)/profile.tsx` |
| 6 | "Nuk ke llogari? Regjistrohu" sat behind the + button, below the social sign-ins | Moved directly under the main button, so it is in view on arrival | `app/(tabs)/profile.tsx` |
| 7 | "Harruat?" did not say what was forgotten | "Harrove fjalëkalimin?" (8 languages) | locale files |
| 8 | The English word "lead" in Albanian text | "klient potencial" | `sq.json` |
| 9 | Messages in the Profile menu had a magnifying-glass icon | A speech bubble | `app/(tabs)/profile.tsx` |
| 10 | Theme and language buttons had 34 pt touch areas | Touch area extended | `theme-toggle-button.tsx`, `app-header.tsx` |

Done earlier in the same period, and part of the same goal: Messages is a
normal tab with the menu always visible, the same fonts on iPhone and Samsung,
and a plain headline instead of a greeting.

## Found sound

- Every control has a name for screen readers (0 unnamed across 17 pages).
- Larger system text is respected, except buttons and badges, which are capped
  at 1.2–1.6× so they do not break.
- Deleting a listing, a lead or the account, marking a listing sold, and
  signing out all ask first.
- Reduce Motion is honoured.
- Loading, error-with-retry and empty states exist on the data screens
  (covered by existing tests).
- Hearts on cards and the back arrow reach 44 pt on phones through `hitSlop`.

## Not changed, and why

| Item | Why |
|---|---|
| White text on solid orange buttons (2.85–3.5:1) | Owner's brand decision (DECISIONS.md C1). **It is the biggest remaining readability issue for older users.** A darker orange was tried in Pass 29 and passes |
| Filter chips at 36–41 pt (leads, performance, search), the wizard's step and language chips (32–42 pt) | Above the 24 pt minimum, under the 44 pt ideal. Mostly agent screens; rows are tight and need a layout decision |
| Terms "Listim" / "Listat e mia" | The product's established word. "Shpallje" may read more naturally: owner's call |
| Four more sign-in options on the first screen (Google, Apple, LinkedIn, code) | Removing any is a product decision. LinkedIn is the one least likely to be needed |
| Sign-in shows Klient / Agjent before signing in | The role matters only at sign-up; hiding it at sign-in is a behaviour change to check first |
| Native dialogs and the date picker | Drawn by the phone, in its own style |

## Final question

*Could a 65-year-old who is not good with technology open this app and
understand its main features alone?*

Probably yes for browsing, searching, saving a home, contacting an agent and
signing up, after these changes. That is a judgement from the screens, not a
result: **it has not been tried with an older person.** Sitting one person
aged 60+ in front of the app with three tasks (find a flat in Tiranë, save it,
send the agent a message) would show more than further review can.

## Tests

`tests/usability.test.mjs` (no text under 12, menu words, delete asks first,
Messages icon). e2e-expo X74 (delete asks), X75 (listing words), X76 (menu
words, sign-up in view).

| Suite | Result |
|---|---|
| Unit `npm test` | 459/459 |
| `tsc --noEmit` | clean |
| Lint | 0 errors (33 warnings, none new) |
| App web build e2e, phone and desktop widths | 232 passed, 0 failed, 46 skipped (first attempt stopped before any test: Windows locked a build folder; the re-run is this result) |
| Website e2e (shared wording) | 261 passed, 0 failed, 9 skipped |
| iOS and Android bundles (`expo export`) | compile |
| On a real iPhone or Android phone | **not tested** |
| With a real older user | **not tested** |

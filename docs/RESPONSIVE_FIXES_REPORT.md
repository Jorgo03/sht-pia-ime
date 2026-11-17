# Responsive fixes report

2026-11-17. Each fix keeps the app's look and all behaviour; no database,
sign-in, permission, search, messaging, favourites or notification logic was
changed.

| Fix | Files | Before | After |
|---|---|---|---|
| Form fields can shrink | `app/+html.tsx`, `app/saved-searches/index.tsx` | Second field of a row ran off phones ≤375px | Both fields share the row at every width |
| Request form on desktop | `app/saved-searches/index.tsx` | Phone sheet from the bottom, cut off | Centred 560px dialog, fades in; phones keep the sheet |
| Explore header | `app/(tabs)/explore.tsx` | Title/search centred, out of line with the grid | Lined up with the grid at tablet and desktop |
| Wanted page | `app/wanted.tsx` | One narrow column, last step against the footer | Intro and steps side by side from 900px; stacked below; space before footer |
| Dark mode panels | `components/property/filter-sheet.tsx`, `components/web/site-header.tsx` | White panel, unreadable heading | Theme card colour |
| Private pages in search | `scripts/expo-web/seo.mjs`, `scripts/expo-web-postbuild.mjs` | No title or noindex in their HTML | Both written at build time |
| Audit coverage | `e2e-expo/site-audit.spec.ts` | 10 sizes; clipped controls not caught | 14 sizes, overlap check, clipped-control check, open request form as its own route |

Earlier in the same audit (`WEBSITE_PAGE_REDESIGN_REPORT.md`): Messages list
beside chat, agencies grid, wide agent dashboard, large listing gallery,
full-width footer on legal pages, sign-in prompts on private pages.

## Left as is, on purpose

- Signed-in list screens (favourites, viewings, notifications, saved
  searches, blocked users, publishing wizard) stay in the 720px column on
  desktop (DECISIONS.md W5): they are short lists and forms.
- Phones show two compact cards per row on Explore (the app's own phone
  layout). At 320px the audit found no overflow or cut-off control; the
  screenshots were reviewed at 375 and 390.

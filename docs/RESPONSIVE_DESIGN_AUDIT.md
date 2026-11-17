# Responsive design audit

2026-11-17. Site: https://real-estate-app-hazel-seven.vercel.app (the Expo
app's web build). Results: `RESPONSIVE_TEST_RESULTS.md`. Fixes:
`RESPONSIVE_FIXES_REPORT.md`.

## How the layout works (what was inspected)

The website is React Native for Web: layouts are flexbox, written once in
`StyleSheet`. There is no hand-written CSS grid or media-query file; the
breakpoints are in code:

- `constants/web-frame.ts`: public pages up to 1280px, signed-in app screens
  in a 720px column, desktop from 1024px.
- `hooks/use-app-dimensions.ts`: the width a screen lays out against (the
  frame, not always the window).
- `components/web/site-header.tsx`: full menu from 1024px; below that a
  hamburger menu with every link, plus the main actions as icons.
- Grids count columns from the width (Explore: one column per ~300px beside
  the filter sidebar on desktop; 3 on tablet; 2 compact cards on phones).
- The footer stacks below 900px and narrows its columns below 600px.

Global page CSS (`app/+html.tsx`) sets full-height root, the theme
background, and now `min-width: 0` on form fields.

## Root causes found

| # | Cause | Where it showed | Fix |
|---|---|---|---|
| 1 | Browser text fields keep a built-in minimum width (~20 characters), so two fields in one row cannot shrink | Wanted request form: "min bedrooms" ran off the right edge at 375 and below | `input, textarea, select { min-width: 0 }` in the page CSS, plus `minWidth: 0` on the row |
| 2 | A screen in the 720px app column measured the column, not the window, when deciding "desktop" | Wanted request form opened as a phone sheet from the bottom on desktop, cut off at 900px tall | Decide from the window width for things drawn over the whole page |
| 3 | Explore's title and search used the centred "readable" column meant for foldable phones, while the grid spans the page | Title floated centred, out of line with the results, on tablet and desktop | On the website the header lines up with the grid (left edge, max 820px) |
| 4 | Wanted page used one narrow column at every width and had no space before the footer | Thin page on desktop; third step touched the footer | Two columns from 900px, max 1080px; bottom padding |
| 5 | `surface` colour is white in the dark palette | Explore filter panel and header menu stayed white in dark mode (found earlier the same day) | Use the theme's card colour |

Checked and found sound: no page wider than the window at any size, no
fixed-pixel page widths, the header never squeezes the desktop menu into a
phone (hamburger below 1024px), sticky header does not cover content,
images use cover with fixed aspect ratios.

## What the automated audit checks

`e2e-expo/site-audit.spec.ts`, for every route as a visitor, client and
agent, at every size: page errors, console errors, 5xx, blank page, page
wider than the window, a control past the screen edge or cut off by a
clipping container, two controls drawn on top of each other, broken images,
stretched photos, and that private pages ask visitors to sign in.

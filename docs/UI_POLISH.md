# UI polish pass — spacing, alignment, sizing (2026-10-21)

Scope: the Expo app, which is the design source of truth (DECISIONS.md W1/W2).
The Vite site is parked and was not restyled.

**How it was checked.** I rendered the app's web build (`expo export -p web`,
the offline test backend, no real data) at widths 320, 360, 390, 430 and 1024
in light mode, and at 390 in dark mode. Each of the 24 screens and states was
captured, and a script measured element bounds for:

- controls past the screen edge
- clipped text that isn't intentionally truncated
- overlapping controls
- controls under 32 px

The screenshots were then reviewed by eye. This is browser evidence for the
React Native layout, **not** a test on an iPhone or Android device. Native
switches, fonts and safe areas can differ slightly (see the gaps below).

## Rules used (existing tokens, made explicit)

| Relationship | Value | Where it lives |
| --- | --- | --- |
| Page gutter | 20 | `AppHeader` (`HEADER_GUTTER`), every screen's content and list containers |
| Header to first content | 16 | `ScreenHero`, Profile, listing stats, My listings title row (12 + pill) |
| Hero to next content | 20, owned by the hero only | `ScreenHero`; what follows adds no top margin |
| Sibling groups | `gap` on the parent, not child margins | section rows, chip rows, action rows |
| Card padding | unchanged (10–16 by card family) | — |
| Icon control target | 44 × 44 (drawn size + `hitSlop`, or a real 44 px box where `hitSlop` does nothing, as on the web) | `SheetCloseButton`, card hearts, chips, language pills, My listings actions |
| Title + side label rows | one line each; the side label moves under the title when both don't fit | Home section headers, Explore count row, agent dashboard sections |

## Issues found and fixed

| Screen/component | Observed problem | Measured cause | Correction | States/platforms | Status and evidence |
| --- | --- | --- | --- | --- | --- |
| `AppHeader` (My listings, Viewings, Saved searches, Agent dashboard, Favorites, listing page) | Centred "Shtëpia.ime" slid under the language/theme or share/save buttons at 320–360 | Fixed 56px insets assumed an 88px control group; language + theme is ~106px | Measures the bar, both sides and the wordmark; shows the wordmark only when it fits between equal insets plus 8px | All back-button screens, both themes | VERIFIED: X19 fails on the old code ("wordmark overlaps Gjuha/Ndaj/Ruaj") and passes now; 320/390 screenshots |
| Listing page header | Chevron and buttons sat 36px in, not on the 20px gutter | The hero wrapper added 16px on top of AppHeader's own 20px | Wrapper side padding removed | Listing page | VERIFIED: screenshot 320 |
| My listings | Delete button off-screen at 320 (329–359px); cards on a 16px gutter under a 20px title; "Listim i ri" squeezed | Six 30px actions (220px) in a non-wrapping row beside the photo (~148px); list padding 16 | Actions wrap; list gutter 20; title shrinks, pill doesn't; actions get 4px slop | 320–430 | VERIFIED: measured overflow 7 → 0; X19 |
| `ScreenHero` (new, replaces 5 copies) | Headline almost touching the next content on 3 screens (4px), 20px on 2, top 16 or 18 | Five copies of the same block with different paddings | One component: 16 above, 20 below; Saved searches' tab row margin removed so the gap isn't doubled | Favorites, Messages, Viewings, Saved searches, Agent dashboard | VERIFIED: screenshots 320/390 |
| Listing stats | Stat grid touching the header line | Scroll content had no top padding | 16 top | All widths | VERIFIED: screenshot 390 |
| Profile (signed in) | Title 8px under the header, 6px above the card | `paddingTop: 8`, no title spacing | 16 above, 12 below the title | All widths | VERIFIED: screenshot 320 |
| Home, Messages | Rows on a 16px gutter under 20px headings | List padding 16 | 20 | All widths | IMPLEMENTED—UNVERIFIED (gutter visible in Home screenshot; Messages list not populated in fixtures) |
| Home / Explore / Agent dashboard section rows | Title and side label both wrapped into ragged two-line columns at 320 | Non-wrapping row squeezing both | The row wraps as a whole; baseline aligned | 320–430, all languages | VERIFIED: screenshots 320 |
| Filter sheet: price and area | "Çmimi mak" clipped at 320; German "Mindestpreis" longer still | ~74px text room per field | Placeholder "Min"/"Maks" (8 languages); the full name stays as the accessible label; the section label names the field | 320+ | VERIFIED: screenshot 320 |
| Filter sheet: bedroom/bathroom chips | "4+" alone on a second line at 320 | 5 chips needed ~316px of 280 | Chip side padding 18 → 12; 4px slop; selected state announced | 320+ | VERIFIED: screenshot 320 (one row; 14px had still wrapped by ~2px) |
| Listing form language pills (`TranslationBar`) | "FR" alone on a second row at 320; 26px tall; 8px slop overlapping neighbours across a 4px gap | Wrapping row of fixed-width pills | One equal-width row, 32px tall, fixed height (no spinner jump), slop vertical 6 and horizontal 3 | New/edit listing | VERIFIED: screenshot 320 |
| Sheet ✕ (Notifications, Edit profile, Report, Request viewing) | 22px tap area on the web; 42px on native | `hitSlop` only, which the web ignores | Shared `SheetCloseButton`: a real 44px box with −11px margins, so the glyph and row height stay | 4 sheets | VERIFIED: measured, no small target left in those sheets |
| Grid card heart | 40px target on native, 24px drawn | `hitSlop` 8 | `hitSlop` 10 → 44 | Explore grid, agent page | IMPLEMENTED (native slop; not measurable in a browser) |
| Profile legal links | 14px-tall tap row | Bare 12px text | 10px vertical padding | Signed in and out | VERIFIED: measured |
| Notification sheet | Asked to inspect closely | — | Already rebuilt in the previous pass: switch centred, ≥12px from the label, no clipping; label wraps at 320 with the switch still centred; ✕ aligned with the title | Light/dark, 320/390 | VERIFIED: screenshots light-320, dark-390 |
| Dead styles | `langTab*` in `app/listing/new.tsx` unused | Superseded by `TranslationBar` | Removed | — | VERIFIED: `tsc`, lint |

## Checked and left alone (intended)

- The floating tab bar over scrolling content (lists reserve its height).
- The password eye inside its field.
- Buttons over the photo on the listing page.
- Leaflet's map tiles extending past the map (they're clipped by the map).
- The page behind an open sheet.
- The OpenStreetMap credit, which stays visible in the bottom-right corner.
- Card titles truncated to one line, which is deliberate.

## Not covered

- **Native devices:** iPhone/Android system switches, Dynamic Type and Android font scale, the keyboard over forms, real safe areas and landscape. No simulator here; run `docs/DEVICE_CHECKLIST.md` on a build.
- **Web zoom to 200% and short viewports for dialogs:** not run.
- **Populated messages and viewings lists:** the offline fixtures have no viewings and an empty thread, so those row layouts were seen only empty.

No functional defects were found in this pass (the notification-switch logic was fixed in the previous pass, see `docs/AUTH_NOTIFICATIONS_EMAIL_REPORT.md`).

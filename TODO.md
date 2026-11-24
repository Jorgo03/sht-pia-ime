# Website restyle after century21albania.com (replica-design)

Owner brief 2026-11-23 (via the working session): match the reference's look,
spacing and interactions; keep our content, brand (orange #ff7d1a → #e85d00,
our fonts), logo, copy, routes, data, features and i18n. Measured, not guessed:
`replica/design/tokens.json`, `constants/theme.ts` `Site`.

## Step 0–1: audit (done)

- [x] Reference measured at 1440 / 1024 / 768 / 390 (computed styles):
      gutters 104 / 80 / 56 / 16; header 73 (1440), 69 (1024), 89 with the
      hamburger (≤768); nav 18px text links ~29px apart, no pill; h1 64/76,
      56/66, 32/40; sections 48 / 80 / 160; buttons 50px, padding 16, square;
      menu overlay rgba(0,0,0,.6), 300ms cubic-bezier(0,0,.2,1); page #f7f7f8.
- [x] Where ours is defined: gutters `constants/web-frame.ts` + per component;
      header `components/web/site-header.tsx` (links in a pill, 13px caps,
      phone menu = small popover); language menu `components/ui/app-header.tsx`
      (Modal dropdown under the button, fade); footer
      `components/web/site-footer.tsx` (own 24px padding); Home sections
      `components/web/website-home.tsx`; Explore `components/web/filter-panel.tsx`.
- [x] Tokens: `Site` + `siteGutter()` + `siteHeading()` in `constants/theme.ts`.
- [x] Contrast: `python .claude/skills/replica-design/contrast.py replica/design/tokens.json`
      → 19 pairs, 0 AA failures (focus ring #b34700; dark text on orange buttons).

## Scope

- [x] 1. Token system applied (no ad-hoc layout numbers in website components)
- [x] 2. Section / card / button / input / footer spacing on the scale
- [x] 3. Navbar: height, gutters, link type and spacing, hover / active / focus,
      phone hamburger → right drawer (overlay, 300 ms slide, Esc, outside click)
- [x] 4. Language menu: trigger, size, position, item padding, current marker,
      animation, keyboard, outside click + Esc, no overflow at 390
- [x] 5. Details: buttons, inputs, cards, badges, focus / hover / disabled,
      footer, loading and empty states
- [x] 6. Responsive 1440 / 1024 / 768 / 390: no sideways scroll, overlap, clipping

## Pages (screenshots before / after in qa-screens/)

- [x] Home  - [x] Explore  - [x] Listing  - [x] Wanted  - [x] Agencies
- [x] Agent / user profile  - [x] Guide, legal, pricing  - [x] Sign in / Profile
- [x] Signed-in app screens (column, via the shared controls)  - [x] 404

Evidence: site audit 96/96 (every route, 3 roles, 14 sizes: no overflow, overlap,
clipping, broken or stretched image, page or console error); screenshots after
in qa-screens/, before (live, 2026-11-23) in qa-screens/before/.

Site audit after the restyle: 96/96 (all routes, 3 roles, 14 sizes; no overflow, overlap or clipping).
Website only: the phone apps keep their own look (IS_WEB). Loading and empty
states use the shared controls; their layout was not redesigned.
Found by checking the preview: the language list was unreadable in the dark
drawer; fixed in 6e32f24.

## Verification

- [x] tsc  - [x] lint (0 errors)  - [x] unit tests 636/636  - [x] test:e2e:expo 443 + 5 rerun after test updates
- [x] Vercel preview checked  - [x] master → production  - [x] live URL checked after the drawer fix (2026-11-24: language names readable in the phone drawer)

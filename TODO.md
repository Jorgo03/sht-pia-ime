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

- [ ] 1. Token system applied (no ad-hoc layout numbers in website components)
- [ ] 2. Section / card / button / input / footer spacing on the scale
- [ ] 3. Navbar: height, gutters, link type and spacing, hover / active / focus,
      phone hamburger → right drawer (overlay, 300 ms slide, Esc, outside click)
- [ ] 4. Language menu: trigger, size, position, item padding, current marker,
      animation, keyboard, outside click + Esc, no overflow at 390
- [ ] 5. Details: buttons, inputs, cards, badges, focus / hover / disabled,
      footer, loading and empty states
- [ ] 6. Responsive 1440 / 1024 / 768 / 390: no sideways scroll, overlap, clipping

## Pages (screenshots before / after in qa-screens/)

- [ ] Home  - [ ] Explore  - [ ] Listing  - [ ] Wanted  - [ ] Agencies
- [ ] Agent / user profile  - [ ] Guide, legal, pricing  - [ ] Sign in / Profile
- [ ] Signed-in app screens (column)  - [ ] 404

## Verification

- [ ] tsc  - [ ] lint  - [ ] unit tests  - [ ] test:e2e:expo (incl. site audit)
- [ ] Vercel preview checked  - [ ] master → production  - [ ] live URL checked

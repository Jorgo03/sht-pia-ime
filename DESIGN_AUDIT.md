# DESIGN_AUDIT.md — visual pass, 2026-07-12

Method note: the Browser-pane screenshot pipeline died mid-audit (all capture
calls time out; JS/DOM inspection still works — harness issue, not the app),
so this audit is CSS+DOM-driven with visual spot-checks deferred to Phase 4.
Every stylesheet and page component was read in full.

## Already good — DO NOT redo

- **Editorial identity**: serif headline + italic orange `em` + mono kicker
  with orange dash. Distinctive, premium, consistent across screens. Keep.
- **Token architecture** (`theme.css`): complete two-theme palette, radius
  scale, shadow tokens, `--ease-out`. Muted text = 55% opacity on warm paper
  ≈ 6.9:1 — passes 4.5:1 both themes.
- **Bottom nav**: already true glass (blur 28px + saturate, translucent both
  themes, `@supports` fallback). Best component in the app.
- **Skeletons**: gradient-sweep shimmer already implemented (Tailwind).
- **Filter sheet**: 350ms slide-in, grip, mono labels, gradient segments.
- **Message bubbles**, **gradient placeholders** for imageless listings,
  **empty states** (dashed border + icon + hint), **cookie banner**,
  **welcome toast**, **featured-card badge** (mono, blur pill).

## Findings

### Global
- **G1 — Zero entrance motion.** Every screen pops in fully formed; lists
  render all-at-once. Biggest single gap vs. "premium" feel.
- **G2 — No `:focus-visible` styling anywhere.** Keyboard users get default
  UA outlines at best; inconsistent with the brand.
- **G3 — No `prefers-reduced-motion` handling** for the animations that do
  exist (sheet slide, toasts, shimmer).
- **G4 — Hover states missing on primary tap targets**: compact-card,
  mini-card, featured-card, fav-row, neighborhood-card have only `:active`
  scale — desktop feels inert. No image zoom on any card.
- **G5 — Saving a favorite gives no feedback** beyond a color change — no
  pop/scale on the heart.
- **G6 — Backdrops are flat black 40%** (filter sheet, add sheet) — no blur,
  reads dated next to the glass nav.
- **G7 — Header is opaque** while the nav is glass — the two chrome bars
  disagree stylistically.
- **G8 — Border widths mixed** (1px vs 0.5px) across files — visually minor
  on mobile DPR; left alone except where touched (logged, not churned).
- **G9 — Newer pages (Viewings, SavedSearches, AgentDashboard,
  PropertyDashboard) are inline-style heavy** — functional and token-based,
  but can't receive shared hover/motion polish without markup edits. They
  inherit the global stagger/focus improvements only. Deliberately not
  restyled this pass (risk > reward on brand-new features).

### Per surface
- **Home**: hero headline strong. Featured card deserves hover raise + slow
  image zoom; search bar could lift on hover. Neighborhood cards fine.
- **Search**: view toggle + chips good. Sort segments (new) inherit segment
  styling — fine. `.load-more-btn` radius `--r-md` amid pill buttons —
  standardize to pill.
- **Property detail**: hero image has **no bottom scrim** — white dots sit
  on bright photos (contrast failure on light images); nav arrows 32px
  (small but acceptable inside photo); stats/agent strip solid.
- **Messages**: rows/bubbles good; needs list stagger only.
- **Favorites**: rows good; stagger + hover.
- **Profile/auth**: DuskHero + glass card already the most "designed" screen;
  social buttons fine. Not touched beyond global polish.
- **MyListings**: 30px icon buttons are below the 40px touch floor — noted;
  NOT changed this pass (dense row layout is a deliberate trade-off, flagged
  in DECISIONS.md).
- **CTA pill**: good gradient + shadow; gains inset top-light + focus ring.

## Plan of application (smallest surface area)

1. `theme.css` — add tokens only: `--fho-navy`, `--fho-ring`, `--ease-spring`,
   `--t-fast/med/slow`, hover shadow.
2. NEW `src/styles/polish.css` (imported last in `main.jsx`) — all motion,
   focus, hover, scrim, backdrop-blur, stagger, heart-pop, reduced-motion
   guard. Pure-CSS: no component markup changes, no props, no i18n impact.
3. `liquid-nav.css` — active-tab dot indicator + FAB idle glow (tiny edit).
4. `header.css` — glass treatment to match nav (tiny edit).

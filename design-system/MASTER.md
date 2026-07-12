# Shtëpia.ime Design System — MASTER

Authored 2026-07-12 (visual redesign pass). The `ui-ux-pro-max` skill is not
installed in this repo, so this document was written by hand to the requested
parameters — variance 7 (distinctive, editorial), motion 6 (noticeable but
purposeful), density 5 (breathing room without dead space) — building on the
already-established identity in `src/styles/theme.css` rather than replacing it.

## 1. Identity — "Editorial Trust"

A premium Albanian real-estate marketplace should feel like a beautifully set
property magazine that happens to be alive: serif headlines with an orange
italic accent, mono-spaced eyebrows like catalogue plate numbers, warm paper
surfaces, photography doing the heavy lifting. Futurism comes from *behavior*
(fluid motion, glass layering, instant feedback), not from sci-fi chrome.

**Do not** re-skin toward generic SaaS (cold grays, blue CTAs, heavy borders).
The existing voice is the asset; the pass sharpens it.

## 2. Color tokens (existing — unchanged, plus two additions)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--fho-bg` | `#f1ede6` | `#141210` | app canvas (warm paper / near-black) |
| `--fho-surface` | `#faf6ef` | `#1e1b18` | cards, sheets |
| `--fho-surface-2` | `#ffffff` | `#252220` | inputs, raised chips |
| `--fho-text` | `#1a1714` | `#f0ece6` | body (≥13:1 on bg) |
| `--fho-text-muted` | 55% text | 55% text | secondary (≥4.5:1) |
| `--fho-orange-1/2/deep` | `#ff7d1a / #e85d00 / #cc5200` | same | brand accent, CTAs |
| **`--fho-navy`** (new) | `#0a2f63` | `#9db8e0` | trust accents: links-on-paper, verified marks. Sparingly. |
| **`--fho-ring`** (new) | `rgba(255,125,26,.45)` | same | focus-visible ring |

Status greens/ambers/reds: keep as-is.

## 3. Type scale (existing fonts: Newsreader serif / Manrope sans / JetBrains Mono)

| Step | Size/leading | Face | Use |
|---|---|---|---|
| Display | 30/1.05, -0.025em | serif 500 | screen headlines (`.screen-headline`) |
| Title | 18/1.2 | serif 500 | section titles |
| Body | 14–15/1.45 | sans 400–500 | copy, rows |
| Label | 12–13/1.3 | sans 600 | buttons, chips |
| Eyebrow | 11/1, +0.14em caps | mono | kickers, counts |

## 4. Space, radius, elevation

- Spacing: 4px base; page gutter 20px (1.25rem); card gap 10–12px; section gap 24–28px.
- Radii (existing scale): `--r-sm 10 / md 14 / lg 18 / xl 22 / 2xl 28 / pill`.
  Images inside cards: one step tighter than their container.
- Elevation (3 levels, never uniform):
  - **rest** — border only (`--fho-border`), no shadow (list rows, chips)
  - **raised** — `--fho-card-shadow` (cards, sheets, dropdowns)
  - **floating** — glass: translucent bg + `backdrop-filter: blur(18px)` +
    hairline light border (bottom nav, header on scroll, FABs, lightbox chrome)

## 5. Motion spec (the core of this pass)

| Pattern | Duration / ease | Where |
|---|---|---|
| Micro press | 120–150ms `--ease-out`, scale .97–.98 | every button, card, row |
| Hover raise | 150–200ms, translateY(-2px) + shadow deepen | cards, CTAs (pointer devices) |
| Entrance rise | 350–450ms `--ease-out`, opacity 0→1 + translateY(10–14px) | screen heads, cards |
| List stagger | 40–60ms per item, cap ~8 items | property grids, favorites, messages, viewings |
| Sheet in | 280ms `--ease-spring` translateY(100%→0) + backdrop fade 200ms | AddSheet, filter sheet, viewing sheet |
| Shimmer | existing keyframes; add gradient sweep on skeletons | loading |

New tokens: `--ease-spring: cubic-bezier(.34,1.3,.5,1)`; `--t-fast: 150ms`;
`--t-med: 280ms`; `--t-slow: 420ms`.

**Hard rules:** nothing blocks input; nothing animates layout of content the
user is reading; everything inside `@media (prefers-reduced-motion: reduce)`
collapses to opacity-only or none.

## 6. Component specs

- **Buttons** (`.cta-pill`, `.pill-btn`, `.ghost-btn`, icon buttons): visible
  `:focus-visible` ring (2px `--fho-ring`, 2px offset); press scale; CTAs get
  a subtle top-edge light (`inset 0 1px 0 rgba(255,255,255,.25)`).
- **Property cards**: image zoom 1.03 on hover (600ms), raise + shadow deepen;
  price stays serif orange; heart gets a pop animation on save.
- **Bottom nav**: true glass (blur + translucency), active tab gets an orange
  dot indicator with a spring slide; center FAB gets breathing glow (4s loop,
  disabled under reduced-motion).
- **Inputs**: focus ring + border-color shift 150ms; error shake is *not* used
  (too noisy) — error text slides in 150ms.
- **Sheets/modals**: spring rise, grip handle, backdrop blur(4px) fade.
- **Skeletons**: gradient sweep, matching final layout footprint exactly.
- **Empty states**: icon in soft orange tint disc, one-line title + hint (already good pattern — standardize).

## 7. Already good — do not redo

Editorial headline pattern (serif + italic orange em + mono kicker), token
architecture, dark theme palette, message bubbles, gradient placeholder system
for imageless listings, cookie banner, welcome toast, lightbox.

## 8. Accessibility floors

Body text contrast ≥4.5:1 both themes (muted text stays ≥4.5 on surface);
touch targets ≥40px; focus-visible on every interactive element;
`prefers-reduced-motion` respected globally.

# Responsive test results

2026-11-17. `e2e-expo/site-audit.spec.ts` on the website built from the Expo
app, Chromium, fake backend (test data only). Command:
`npx playwright test -c playwright.expo.config.ts e2e-expo/site-audit.spec.ts --project=desktop`.

**Sizes:** 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1024×768,
820×1180, 768×1024, 430×932, 414×896, 390×844, 375×812, 360×800, 320×720.
Public pages as a visitor: all 14. Every page as a client and an agent, and
private pages as a visitor: 1920, 1440, 1280, 1024, 820, 768, 390, 375, 320.

**Last run (after the fixes): 96 of 96 passed** — 32 routes × 3 roles.
No page wider than the window, no control off screen or clipped, no
overlapping controls, no broken or stretched image, no page or console
error, at any size.

Screenshots: every route and role at 1440×900, 820×1180, 390×844 and
375×812 in `qa-screens/` (git-ignored; the command above regenerates them).
Reviewed by eye: home, explore, wanted, wanted form, listing, chat, agent
dashboard, notifications, saved searches.

| Route | Visitor | Client | Agent |
|---|---|---|---|
| `/` | ✅ 14 sizes | ✅ | ✅ |
| `/explore`, `/explore?city=…` | ✅ 14 | ✅ | ✅ |
| `/wanted` | ✅ 14 | ✅ | ✅ |
| `/agents`, `/agent/<id>`, `/user/<id>` | ✅ 14 | ✅ | ✅ |
| `/property/<id>` | ✅ 14 | ✅ | ✅ |
| `/compare`, `/guide`, `/privacy`, `/terms`, `/cookies`, `/pricing` | ✅ 14 | ✅ | ✅ |
| `/profile` (sign in) | ✅ 14 | ✅ | ✅ |
| 404 | ✅ 14 | ✅ | ✅ |
| `/messages`, `/messages/<id>` | ✅ asks to sign in | ✅ | ✅ |
| `/favorites`, `/saved-searches`, request form, `/viewings`, `/notifications` | ✅ asks to sign in | ✅ | ✅ |
| `/my-listings`, `/listing/new`, `/blocked-users` | ✅ asks to sign in | ✅ | ✅ |
| `/agent-dashboard`, `/leads`, `/performance`, `/listing/import` | ✅ asks to sign in | ✅ "for agents" | ✅ |
| `/listing/<id>/edit`, `/listing/<id>/analytics` | ✅ asks to sign in | ✅ | ✅ |

Found and fixed during these runs: the request form's second field off
screen at ≤375px; the request form not centred on desktop; the "show
password" eye flagged as an overlap (a button inside a field, by design;
the check now allows it).

Not covered: real iPhones/Android devices, Safari and Firefox engines,
landscape phones, an open on-screen keyboard. Interactions (menus, forms,
chat, filters) are covered by the functional suite
(`WEBSITE_FUNCTIONALITY_TESTS.md`), mostly at 1280 and the phone project's
size.

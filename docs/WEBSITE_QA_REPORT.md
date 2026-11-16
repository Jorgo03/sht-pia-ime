# Website QA report

2026-11-16, commit 902a2ed (master, live). Evidence is command output or live
requests from this run.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors (34 warnings, all older than this work) |
| `npm test` (unit, 630 tests) | 630 passed, 0 failed |
| `npm run test:e2e:expo` (website build, phone + desktop, offline fake backend) | 342 passed, 0 failed, 46 skipped (AI chat is switched off by the owner; some tests are phone-only or desktop-only) |
| New tests this phase | rentalPriceRule (3), cityOrder (3), X107 client on agent pages (×3 pages, ×2 projects), X108 city search |
| Agent report privacy (live database, rolled back) | the agent 1 row, another agent 0, a client 0, anon: no access (`supabase/tests/agent_report_privacy.sql`) |
| Secrets in the website build | no service-role key, no Anthropic key; every JWT in the bundle is the anon key |
| Supabase security advisors | nothing introduced by the web work; findings are older (7 tables with RLS and no policies by design, 2 public SECURITY DEFINER functions used for public profiles, leaked-password protection off: needs Pro) |
| Layout at 1920, 1600, 1440, 1366, 1024, 768, 430, 390, 375, 360 | no horizontal overflow at any width |
| Wheel in the margin at 1920 (live) | scrolls the page: 0 → 800 |
| Live pages (status) | `/`, `/explore`, `/wanted`, `/guide`, `/cookies`, `/agents`, a listing, `/profile`, `/messages`, `/agent-dashboard`, `/sitemap.xml`, `/robots.txt`: 200; unknown address: 404 |
| Live data | property queries answered 200/206 on Home, Search and a listing; 0 page errors at 1920, 1366 and 390 |

## Mismatches found and fixed in this phase

- Price per m² was computed separately on the listing page and the list row;
  both now use the shared sales-only rule.
- City lists were alphabetical; Tirana and Durrës now come first.
- The agent dashboard and leads opened for clients; they now say they are for
  agents.
- The page did not scroll with the wheel over the side margins on wide
  screens; it does now.

## Remaining

- Plazh and Currila are not in the location dataset (owner decision to add).
- No browser push notifications.
- The page scrolls inside its container, not the browser document.
- Visual comparison with the running phone app was not possible here (no
  device or simulator); compared through shared code and tokens instead.
- App ↔ website sync was not tested live with two devices; both use the same
  tables.

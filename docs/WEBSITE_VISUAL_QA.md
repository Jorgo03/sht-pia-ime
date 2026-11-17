# Website: visual QA

2026-11-17. The audit saves a screenshot of every route, for every role, at
1440×900 and 390×844 (186 images) to `qa-screens/` (git-ignored, regenerated
by `npx playwright test -c playwright.expo.config.ts e2e-expo/site-audit.spec.ts --project=desktop`).
Photos in those shots are flat placeholders: the fake backend serves 64×64
test images, never real listings.

Reviewed by eye at 1440×900:

| Page | Finding |
|---|---|
| Messages, chat | List and chat side by side, active row marked ✅ |
| Listing | Large gallery, facts left, contact card right ✅ |
| Agent dashboard | Wide, 4 stat cards in a row, report link, today, requests ✅ |
| Explore | Filter sidebar, 3-column grid, sort ✅ — title not aligned with the grid (minor, open) |
| Agencies | 3-column grid ✅ |
| Notifications, saved searches | 720px column, empty and filled states clear ✅ |
| Legal, guide, wanted | Full-width black footer ✅ |
| Home | Hero with Tirana photo, search, city tiles, closing band ✅ |

Images: the audit flags any photo drawn into a box of another shape without
cover/contain ("stretched"): none on the last run. Cards use a fixed
aspect ratio with cover. Live listing photos checked by hand were sharp.

# Website feature checklist

2026-11-16. Each feature is the app's own code running in the browser
(`docs/APP_WEBSITE_PARITY_REPORT.md`). "Checked by" names the automated test
that ran it on the website build (`e2e-expo/`, fake backend, offline) or the
live check.

| # | Feature | Checked by | Result |
|---|---|---|---|
| 1 | Homepage: hero, search, live numbers, latest homes, steps, services, cities, footer | X85, X36, X01, screenshots of the live site | ✅ |
| 2 | Search and filters: sale/rent, type, city, zone, price, rooms, baths, area, amenities, sort, reference | X02, X35, X98, X101, X108 | ✅ |
| 3 | Locations: generated dataset, aliases, Tirana then Durrës first | X108, tests/cityOrder.test.mjs | ✅ (Plazh and Currila added, W8) |
| 4 | Rental price rule: no price per m² on rentals | X77, tests/rentalPriceRule.test.mjs | ✅ |
| 5 | Property cards and details, own URL, meta tags | X01, X48, X99, X103; live `/property/<id>` with title, canonical, hreflang | ✅ |
| 6 | Publish and edit listings, photos to storage | X20, X21, X22, X23, X53, X70, X102 | ✅ |
| 7 | Auth: email + password, email code, sign-up with 6-digit code, password recovery, Google | X03, X17, X18, X27, X32, X56–X62, X87–X92 | ✅ (Google not runnable offline) |
| 8 | Roles and privacy: agent tools hidden from clients; agent reports private | X107, X69, X66; supabase/tests/agent_report_privacy.sql (live, rolled back) | ✅ |
| 9 | Own profile and public profile | X05, X25, X26, P1–P8 | ✅ |
| 10 | Messaging: list, thread, send, live arrival, report, block | X06, X63, X84, C1–C9, X72, X73 | ✅ |
| 11 | Favourites: save, remove, list | X04, X29, X105 | ✅ |
| 12 | Notifications: centre, unread badge, live banner | X81, X82, X83, X84, X93 | ✅ (no browser push) |
| 13 | Maps: Leaflet, markers, near me | X100 | ✅ |
| 14 | Dashboards: client (profile, saved, viewings) and agent (dashboard, leads, report) | X39, X40, X41, X42, X66–X68, X71, X74, X104 | ✅ |
| — | Languages (10) and `?lang=` links | X07, X64, tests/webSeoLinks.test.mjs | ✅ |
| — | Currency toggle and price history | tests/currency.test.mjs, tests/priceHistory.test.mjs | ✅ |
| — | Offline banner | X106 | ✅ |

## Remaining differences

- Push notifications: the browser has none; the notification centre and badge
  work.
- Page scrolling: inside the page container, not the browser document (React
  Native for web). The mouse wheel works anywhere on the page.
- Navigation: a website header and footer instead of the app's bottom tab bar
  (owner decision, DECISIONS.md W5).
- Sync between app and website (favourites, messages, listings) uses the same
  tables by construction; it was not exercised live with two devices.

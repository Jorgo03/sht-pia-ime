# Website: responsive QA

2026-11-17, `e2e-expo/site-audit.spec.ts`, fake backend.

Sizes: 1920×1080, 1600×900, 1440×900, 1366×768, 1024×768, 768×1024,
430×932, 390×844, 375×812, 360×800.

- Public pages as a visitor: all 10 sizes.
- Every page as a client and an agent, and private pages as a visitor:
  1920, 1440, 1024, 768, 390 and 360 wide.

Checked at each size: page not wider than the window (no sideways scroll),
no button, link or field cut off at the edge (controls inside a scrolling
strip, such as chip rows, are allowed), page not blank, no broken image,
no squashed photo.

Result: **93 of 93 tests passed, 0 failures** at every size listed above.

Fixed during the audit: none of the sizes produced overflow on the last
run; earlier issues fixed this round were layout ones (see
`WEBSITE_PAGE_REDESIGN_REPORT.md`).

Not covered: real devices (only Chromium window sizes), Safari and Firefox
engines, landscape phones.

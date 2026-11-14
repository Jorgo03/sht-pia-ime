# Locations audit: final report

The mission was to replace every fake or misplaced location in the app with real Albanian places, verified against sources, and to make sure no fake location can get in again. Branch `fix/real-albania-locations`.

**Status: done.** Checkpoint 2 approved and applied on 2026-11-14: the live database has the locations table, the guard and the linked listings, and both AI functions are deployed. Details in the last section.

## What was there (step 1, `INVENTORY.md`)

- One list of 31 cities and 323 zones (274 distinct names) in `src/features/properties/data/locations.js`, used by both apps.
- **Found later:** the website's new-listing form had its own hand-kept list of 13 cities (`src/features/listings/pages/NewListing.jsx`). It now uses the shared list.
- Map defaults: Skanderbeg Square, Tirana, which is correct.
- AI prompt examples: real places, but one example zone, "Plazh", has no source.
- Translation strings: real cities only.
- Seed data: 12 listings in Tirana, all real places.
- Live data: 3 listings (Tiranë ×2, Durrës), with no zone set; no wanted homes.

## The reference (step 2, `SOURCES.md`)

`data/albania-locations.json` holds 1,334 places:
- 12 qarqe, 61 bashki and 373 njësi administrative: Law 115/2014, checked against OpenStreetMap outlines. Every municipality is in the right county and every unit is in the right municipality.
- 150 lagje, 717 villages, and 21 area names known by a street or landmark.

Each place carries its sources (OpenStreetMap id, Wikidata id), names in 8 languages, indefinite and definite forms, aliases, a centroid and the outline's box. It has a postal code where OpenStreetMap has one.

## Findings and what was done (step 3, Checkpoint 1: "Approve all")

| Original zones | Count | Done |
|---|---|---|
| ✅ valid | 183 | kept, spelled as the source spells them |
| 🔁 in the wrong municipality | 47 | moved to the municipality they are in |
| ✏️ misspelled | 15 | renamed (Kanina → Kaninë, Apolloni → Apollonia, Vlorë Qendër → Qendër Vlorë…) |
| ❓ Qendër ("centre") | 26 | replaced by the official units |
| ❓ real street or landmark used as an area name | 19 + 1 | kept as area names (Myslym Shyri, Rruga e Kavajës, Liqeni i Thatë…). Mango was confirmed by a second OpenStreetMap search |
| ❓ only traces, no source as a place | 23 | removed (Plazh, Kala, Partizani, Lungomare in Sarandë…) |
| ❌ does not exist | 8 | removed, no replacement invented (Përmet i Durrësit, Himara Jugor, Liqeni i Korçës, Kukës i Ri, Kukës i Vjetër, Rrethi i Ri, Skelë, Dunavat) |

The full per-row record is in `VALIDATION_REPORT.md`, and the frozen decisions are in `decisions.json`.

## What the apps offer now (step 4)

- **61 cities, one per municipality**, named after the seat town as before. Where the municipality has another name, the picker shows it: "Peshkopi (Dibër)", "Koplik (Malësi e Madhe)".
- **525 zones:**
  - every municipality's official units;
  - lagje for the main markets;
  - every approved zone of the original list.

The list is **generated** (`scripts/locations/generate-app-list.mjs`), never hand-edited. Run again on the new list, the validator finds 570 valid and 20 area names (the approved streets and landmarks), with no fake, misplaced or misspelled entry (`validation-current.json`).

The cities and zones on live listings (Tiranë, Durrës) are unchanged, so no user data had to change.

## No fake place can get in again (step 6)

**Pickers only.** Both apps let you choose a city and zone from the list; nothing typed is saved as a place. The phone pickers gained a search box. It matches without diacritics and by alias: "tirana", "durazzo", the old spelling "Laprakë".

**Search** resolves aliases and exonyms to the stored name. For example, "tirane" now finds listings in Tiranë, which a plain `ilike` missed. This applies to free text and to the AI search's city in both apps, and to the AI assistant (`supabase/functions/ai-assistant/places.js`).

**Pin check:** the map pin must be inside Albania and inside the chosen city's municipality. Both apps check it before saving, with a message in all 8 languages.

**Database guard** (`supabase/migrations/20261114215248_locations.sql`, live):
- a `locations` table: everyone reads it, only moderators write it;
- `location_id` on listings and wanted homes, set by the database and not by clients;
- a trigger that refuses an unknown city, a zone that is not that city's, and a pin outside Albania or outside the municipality.

**Tests:**
- `tests/locations.test.mjs` (12 tests): the dataset's divisions; every zone real and inside its municipality; no removed zone back; aliases; autocomplete; pin checks; map defaults and seed pins; AI cities in sync.
- Plus additions to `searchFilters`, `aiSchemas` and `aiAssistant` tests.
- `supabase/tests/rls_locations.sql`: 14 checks, passing 14/14 in a local Postgres. The migration was applied there to copies of the three live listings and rolled back cleanly.
- Totals: 587 unit tests pass; 271 website and 332 Expo-web browser tests pass; type-check clean; lint has no errors.

## Checkpoint 2: applied (approved: "Yes, apply and deploy")

1. **Migration `20261114215248_locations`:** the table, the two columns and the guard.
2. **Seed** (`supabase/locations_seed.sql`), 659 rows: the 12 counties, the 61 municipalities, the 373 units, and the zones the apps offer that are not units. The 717 villages and lagje that are not offered stay only in `data/albania-locations.json`.
   - Live counts: 61 cities, 525 offered zones (the same as the apps), and no broken parent links.
3. **Migration `20261114220533_locations_map_listings`:** every listing and wanted home is backed up in `locations_backup_20261114`, a private table with no policies. The 3 listings now point to Bashkia Tiranë (2) and Bashkia Durrës (1).
   - City, zone, address, pin and the "last updated" time are unchanged.
4. **Live check** `supabase/tests/rls_locations.sql`: **passed=14/14**, rolled back.
5. **Advisors:** the only new note is the backup table having no policies. That is intended.
6. **Deployed:** `ai-parse-search` (version 6) and `ai-assistant` (version 2).
   - Both answer an empty request with their own 400, so both start.
   - `ai-parse-search` also carries the currency change from 2026-10-26, which that commit had marked as needing a deploy.
   - No paid AI call was made to test them.

Undo: `supabase/rollback_locations.sql`.

**Cleanup after applying.** 89 definite forms that the grammar rule had guessed for names of several words, with numbers or ending in -o ("Alia Demi", "10i Korriku") were set to empty, in the dataset and in the database. Definite forms now come from a source, or from the rule for single words only; otherwise there is none.

## Not done, or for later

- **Postal codes:** present for 317 of 373 units, and missing for some municipalities and villages, because OpenStreetMap lacks them. No code is guessed.
- **Definite forms:** 980 follow the grammar rule for single words (marked `rule`), 233 have none, 119 come from a source. Worth a native speaker's pass.
- **Lagje outside the main markets:** only official units and approved zones are listed. More lagje can be added from the dataset when needed.
- **Real-device testing:** not done for these changes. The checks above ran in Node, Chromium and a local Postgres.

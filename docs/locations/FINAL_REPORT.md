# Locations audit: final report

The mission was to replace every fake or misplaced location in the app with real Albanian places, verified against sources, and to make sure no fake location can get in again. Branch `fix/real-albania-locations`.

**Status: 🛑 waiting at Checkpoint 2.** The code is done and tested. The database part is written and tested locally, but it is **not applied** to the live database. See the last section.

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

**Database guard** (`supabase/pending/locations.sql`). This is not live yet:
- a `locations` table: everyone reads it, only moderators write it;
- `location_id` on listings and wanted homes, set by the database and not by clients;
- a trigger that refuses an unknown city, a zone that is not that city's, and a pin outside Albania or outside the municipality.

**Tests:**
- `tests/locations.test.mjs` (12 tests): the dataset's divisions; every zone real and inside its municipality; no removed zone back; aliases; autocomplete; pin checks; map defaults and seed pins; AI cities in sync.
- Plus additions to `searchFilters`, `aiSchemas` and `aiAssistant` tests.
- `supabase/tests/rls_locations.sql`: 14 checks, passing 14/14 in a local Postgres. The migration was applied there to copies of the three live listings and rolled back cleanly.
- Totals: 587 unit tests pass; 271 website and 332 Expo-web browser tests pass; type-check clean; lint has no errors.

## 🛑 Checkpoint 2: what needs your approval

Nothing below has run on the live database:

1. **Apply `supabase/pending/locations.sql`, then `locations_seed.sql`.** This adds the table, the two columns and the guard, then fills the 1,334 places. It is additive.
2. **Apply `locations_map_listings.sql`.** It backs up every listing and wanted home into `locations_backup_20261114`, then sets `location_id` on the 3 live listings. Their city, zone, address and pin are not changed. Expected result: two listings point to Bashkia Tiranë and one to Bashkia Durrës.
3. **Deploy `ai-assistant` and `ai-parse-search`.** This applies the city aliases and the clearer prompt examples (no "Plazh"). It does not switch either one on or off.

Undo: `supabase/pending/locations_rollback.sql`.

After approval, the live check `supabase/tests/rls_locations.sql` should read `passed=14/14`.

## Not done, or for later

- **Postal codes:** present for 317 of 373 units, and missing for some municipalities and villages, because OpenStreetMap lacks them. No code is guessed.
- **Definite forms:** 1,023 follow the grammar rule (marked `rule`), not a source. Worth a native speaker's pass.
- **Lagje outside the main markets:** only official units and approved zones are listed. More lagje can be added from the dataset when needed.
- **Real-device testing:** not done for these changes. The checks above ran in Node, Chromium and a local Postgres.

# Location sources

Where every place in `data/albania-locations.json` comes from, and how the app's current locations were checked against it. Step 2 of the locations audit; the results are in `VALIDATION_REPORT.md`.

## The administrative divisions

| What | Count | Source |
|---|---|---|
| Qarqe (counties) | 12 | OpenStreetMap boundaries, `admin_level=6`, with their ISO 3166-2 codes (AL-01 … AL-12) |
| Bashki (municipalities) | 61 | **Law 115/2014** "Për ndarjen administrative-territoriale të njësive të qeverisjes vendore në Republikën e Shqipërisë", as listed on [Wikipedia: Municipalities of Albania](https://en.wikipedia.org/wiki/Municipalities_of_Albania) (revision 1377087644, last edited 27 September 2026, read 14 November 2026), cross-checked against the OpenStreetMap boundaries (`admin_level=7`) |
| Njësi administrative (units) | 373 | The same law and page (its totals row: 61 municipalities, 373 units), cross-checked against the OpenStreetMap boundaries (`admin_level=8`) |
| Lagje and villages | 150 lagje, 624 villages | OpenStreetMap named places (`place=suburb/neighbourhood/quarter/village/hamlet`) and lagje boundaries (`admin_level` 9 and 10). Listed in full for the main markets (Tiranë, Durrës, Vlorë, Sarandë, Shkodër, Korçë, Elbasan, Fier, Kamëz, Himarë); elsewhere only the ones the app already offers, once verified |

**No newer reform.** Both Wikipedia pages read on 14 November 2026 describe the 2015 structure: 61 municipalities and 373 units. Neither mentions a later change. The 2014 law is still the current one.

**The law list and OpenStreetMap agree completely.** All 61 municipalities lie in the county the law gives them (checked by geometry, below). All 373 units are found inside the right municipality. Where the two spell a name differently, the law's spelling is used and OpenStreetMap's is kept as an alias:

| Law 115/2014 | OpenStreetMap |
|---|---|
| Vau i Dejës (municipality and unit) | Vau-Dejës |
| Dimal (unit) | Ura Vajgurore |
| Katund i Ri | Katundi i Ri |
| Rrashbull | Rashbull |
| Funarë | Funar |
| Kodër-Thumanë | Thumanë |
| Ujëmisht | Ujmisht |
| Zagori | Zagorie |
| Qendër Librazhd | Librazhd Qendër |
| Prrenjas | Përrenjas |
| Grykë-Çajë, Tërthore, Fushë Kuqe, Fushë-Çidhën, Lenie, Fier-Shegan, Vendreshë, Labinot-Fushë, Labinot-Mal, Iballë | the same names with a different ë or hyphen |

One gap in OpenStreetMap: it maps Kamëz's two units (Kamëz and Paskuqan) one level lower (`admin_level=9`). Paskuqan is taken from that boundary. Kamëz is the municipality minus Paskuqan, and its entry says so in a `note`.

## Names in 8 languages

`names` holds the name in sq, en, it, de, fr, es, pl and ru, taken from **Wikidata** labels (each entry's `source.wikidata`), else OpenStreetMap's `name:<lang>` tags. That is where exonyms come from: Durazzo, Valona, Scutari, Argirocastro, Coriza; Дуррес, Влёра. A language with no sourced name is left out, and the app shows the Albanian name for it. Nothing is translated by hand.

`aliases` collects, for search:
- Wikidata aliases;
- OpenStreetMap `alt_name` and `old_name`;
- every language's name;
- the unaccented form (`durres`);
- the definite form.

**Indefinite and definite forms.** `name.indefinite` is the official name (Durrës, Vlorë, Shkodër). `name.definite` (Durrësi, Vlora, Shkodra) comes from one of three sources, recorded in `name.definite_source`:

- `sq.wikipedia`: the Albanian Wikipedia article title, which names a town in its definite form (Kamza, Gjirokastra);
- `wikidata`: the Albanian Wikidata label, when it is plainly the definite form;
- `rule`: the standard Albanian rule, for a single word only, when no source gives the form: -ë → -a, -ër → -ra, -i → -ia, -k/-g/-h → -u, otherwise +i.
- `none`: no definite form. This applies to a name of several words, with a number or brackets, or ending in -o ("Ali Demi", "10 Korriku", "Kinostudio"): the rule cannot tell which word changes, or how.

A county takes its seat's form.

## Coordinates and postal codes

`centroid` is, in order of preference:
- the seat town's OpenStreetMap node, for a county or municipality;
- the unit's `admin_centre` node, or the place of the same name inside it;
- a point computed inside the boundary.

`centroid.source` says which. Every centroid is checked to lie inside Albania's box (lat 39.6–42.7, lng 19.2–21.1).

`postal_code` is OpenStreetMap's `postal_code` tag (Albanian postal codes, e.g. Kashar 1051, Sukth 2010). It is present for 317 of 373 units, and only partly for municipalities and villages. Where OpenStreetMap has none, it is `null`. No code is guessed.

## How hierarchy is decided

By geometry, not by address text. Nominatim's address fields leave out the municipality for several towns (Durrës, Lezhë, Kukës, Krujë, Bulqizë), so they cannot be trusted for this.
- A municipality belongs to the county its interior lies in.
- A unit belongs to the municipality its interior lies in.
- A place belongs to the unit its point lies in.

The test is point-in-polygon (even-odd rule) over the OpenStreetMap outlines.

## How the app's locations were checked

For each zone of each city (`scripts/locations/validate.mjs`), in this order:

1. **In the city's own municipality:** a unit, a place, or a lagje boundary of that name (ignoring diacritics, hyphens, and indefinite/definite endings). Found → ✅. Found only with a different spelling → ✏️.
2. **Elsewhere within 40 km:** the same name in a neighbouring municipality → 🔁, with the nearest one proposed. A namesake further away is not taken to be the same place.
3. **Something real but not a lagje or village** (a street, a square, a beach, a lake, a market) → ❓, with the object cited.
4. **Only traces** (things named after it, such as "Rruga …" or "Plazhi i …") → ❓.
5. **Nothing at all** → ❌, with removal proposed and no replacement invented.

Searches behind each step:
- 4,560 named OpenStreetMap places;
- the 373 units;
- 42 lagje boundaries;
- Nominatim searches for each zone, both alone and with its city, then with and without diacritics, in definite and genitive form, and as "Lagjja …".

## Fetching

- **Overpass API** (overpass-api.de): three queries for boundaries and places, cached.
- **Wikidata API:** batches of 50.
- **Nominatim** (nominatim.openstreetmap.org): at most 1 request per 1.1 s, with User-Agent `ShtepiaIme-location-audit/1.0 (github.com/Jorgo03/sht-pia-ime)`. Every response is cached in `docs/locations/osm-cache.json`, so a rerun makes no requests.

The raw downloads, including tens of MB of outlines, live in `docs/locations/cache/`. That folder is not committed: `fetch-sources.mjs` rebuilds it.

OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0. Wikidata is CC0.

## Rebuilding

The audit, run once against the original list (Checkpoint 1):

```
node scripts/locations/fetch-sources.mjs     # downloads (once)
node scripts/locations/verify-osm.mjs        # Nominatim, pass 1 (cached)
node scripts/locations/classify.mjs          # pass-1 summary, feeds pass 2
node scripts/locations/verify-pass2.mjs      # Nominatim, spelling variants (cached)
node scripts/locations/validate.mjs docs/locations/validation.json
node scripts/locations/report.mjs            # VALIDATION_REPORT.md
node scripts/locations/decide.mjs            # decisions.json: the approved outcome, frozen
node scripts/locations/inventory.mjs         # INVENTORY.md
```

After that, to change the places the apps offer, change the sources (or
`decisions.json`), never the generated files, and run:

```
node scripts/locations/build-dataset.mjs     # data/albania-locations.json
node scripts/locations/generate-app-list.mjs # src/…/data/locations.js, the AI's places.js, the database seed
node scripts/locations/validate.mjs          # validation-current.json: checks the new list
npm test -- tests/locations.test.mjs
```

The database copy is updated by running the regenerated
`supabase/locations_seed.sql` (it updates rows in place).

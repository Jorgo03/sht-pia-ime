# Translation Notes

Items below may need review by a native speaker.

## Polish (pl.json)
- `checkEmail`: "potwierdzić" — verify correct imperative form
- `results_other`: Polish has complex plural rules (1, 2-4, 5+). i18next `_other` covers 2+, which is a simplification. Consider adding `_few` for 2-4 range.

## Russian (ru.json)
- `results_other`: Russian has three plural forms (1, 2-4, 5+). i18next `_other` covers the general case. Consider adding `_few` suffix for 2-4 range.
- `beds`/`baths` abbreviations: "комн." / "ванные" — verify these are natural for property listings

## German (de.json)
- `roleAgent`: "Makler" is specifically a real estate agent. Could also be "Agent" if a more general term is preferred.

## French (fr.json)
- `beds`: "ch." (short for "chambres") — verify this abbreviation is clear in context

## Albanian (sq.json) — source of truth
- `anyLocation`: "Çdo vendndodhje" — verify if "Të gjitha vendndodhjet" sounds more natural
- `listingType`/`propertyType`: "Lloji" — confirm this is preferred over "Tipi"

## All languages
- Provider names (Google, Apple, Microsoft, LinkedIn) are kept untranslated as they are brand names
- `m²` / `м²` are used as-is; no localization needed for the unit symbol
- Currency formatting is handled by `Intl.NumberFormat` at runtime, not in translation files

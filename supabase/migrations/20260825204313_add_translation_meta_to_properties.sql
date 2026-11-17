-- Per-language provenance for title_i18n / description_i18n, so the listing
-- form can tell three cases apart that were previously indistinguishable:
-- a machine translation still matching its Albanian source, one whose source
-- has since been edited (stale), and text a human wrote or corrected by hand.
--
-- Shape: { "en": { "sourceHash": "...", "manual": false, "updatedAt": "..." }, ... }
--   sourceHash  fingerprint of the Albanian title+description this was made
--               from; differs from the current fingerprint => stale.
--   manual      true once an agent edited the translation, which pins it
--               against automatic regeneration until they ask for it.
--
-- Deliberately additive and default-safe. Existing rows keep every translation
-- they already have; they simply have no metadata, and the client treats
-- text-without-metadata as manual so a human's words are never overwritten by
-- a guess. Nothing is translated by this migration — translations are produced
-- lazily when a language is actually selected.
alter table public.properties
  add column if not exists translation_meta jsonb not null default '{}'::jsonb;

comment on column public.properties.translation_meta is
  'Per-language translation provenance for title_i18n/description_i18n: { "<lang>": { "sourceHash", "manual", "updatedAt" } }. Absent entry with text present is treated as human-authored.';

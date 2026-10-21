-- Zone and reference-number search (docs/LAUNCH_TASKS.md F19).
--
-- zone: the neighbourhood inside the city, picked from the per-city lists in
--   src/features/properties/data/locations.js when a listing is created or
--   edited. Optional, so every existing listing stays valid (zone null).
-- ref_code: a short reference every listing gets automatically, shown as
--   "SH-XXXXXXXX" (the first 8 hex characters of its id, upper-case). Derived,
--   so it can never be set, edited or duplicated by hand, and older listings
--   have one too. 8 hex characters = 4.3 billion values; uniqueness was
--   checked across the existing rows, and a collision would only make a
--   reference search return two listings, never the wrong one alone.
--
-- Additive. Tested first in a rolled-back transaction on the live project,
-- 6/6 (agent insert with zone, ref generated, ref not settable (428C9), zone
-- length bound, visitors filter by zone and find by ref). Applied 2026-10-21.
alter table public.properties
  add column zone text check (zone is null or char_length(zone) between 1 and 80);
comment on column public.properties.zone is
  'Neighbourhood within the city, from src/features/properties/data/locations.js. Optional.';

alter table public.properties
  add column ref_code text generated always as (upper(left(replace(id::text, '-', ''), 8))) stored;
comment on column public.properties.ref_code is
  'Short reference shown as SH-XXXXXXXX on the listing; derived from id, cannot be set.';

create index properties_ref_code_idx on public.properties (ref_code);
create index properties_city_zone_active_idx on public.properties (city, zone) where status = 'active';

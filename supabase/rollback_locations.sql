-- Undoes supabase/pending/locations.sql and locations_map_listings.sql.
-- location_id is the only value those wrote to existing rows, and it is
-- dropped with its column; city, zone, address and pins were never changed.
-- The backup table is kept, in case anything else needs checking against
-- it; drop it by hand once that is done.
drop trigger if exists properties_locations_guard on public.properties;
drop trigger if exists wanted_homes_locations_guard on public.wanted_homes;
drop function if exists public.locations_guard();
drop function if exists public.locations_guard_city_only();
alter table public.properties drop column if exists location_id;
alter table public.wanted_homes drop column if exists location_id;
drop table if exists public.locations;

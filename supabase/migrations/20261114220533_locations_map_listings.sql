-- Fills location_id on the listings and wanted homes that exist already
-- (supabase/migrations/20261114215248_locations.sql must be applied first). 🛑 Checkpoint 2:
-- this is the step that writes to existing rows; it runs only on approval.
--
-- It changes nothing a person typed: city, zone, address and the pin stay
-- as they are. Writing location_id fires the guard, which works the id out
-- from city and zone and checks the pin; a row the guard refuses stops the
-- whole migration, with the reason, and nothing is written.
-- Undo: supabase/rollback_locations.sql (restores from the backup).

-- Backup first: every column this touches or reads, for every row.
create table public.locations_backup_20261114 as
  select 'properties'::text as tbl, id, city, zone, latitude, longitude, location_id, now() as backed_up_at from public.properties
  union all
  select 'wanted_homes', id, city, null, null, null, location_id, now() from public.wanted_homes;
alter table public.locations_backup_20261114 enable row level security;
revoke all on public.locations_backup_20261114 from anon, authenticated;
comment on table public.locations_backup_20261114 is 'Rows before locations_map_listings.sql (locations audit). Private: no policies.';

-- Filling an id is not an edit: keep each listing's "last updated" time
-- (properties_updated_at would set it to now).
alter table public.properties disable trigger properties_updated_at;
update public.properties set location_id = null;
alter table public.properties enable trigger properties_updated_at;
update public.wanted_homes set location_id = null;

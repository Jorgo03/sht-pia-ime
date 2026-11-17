-- Real Albanian locations (docs/locations/, the locations audit).
--
-- public.locations   the one list of real places: 12 qarqe, 61 bashki,
--                    373 njësi administrative (Law 115/2014), lagje,
--                    villages and the zones the apps offer. Filled by
--                    supabase/locations_seed.sql, generated from
--                    data/albania-locations.json. Everyone may read it; only
--                    moderators (public.is_moderator()) may change it.
-- location_id        on properties and wanted_homes: the place a row is in
--                    (its zone, else its city's municipality). Set by the
--                    database from city and zone; a client cannot set it.
-- the guard          a listing or wanted home must name a city the apps
--                    offer and, if any, one of that city's zones; a listing's
--                    pin must lie inside Albania and inside its city's
--                    municipality (the outline's box, plus about 1 km). The
--                    apps check the same before saving (lib/places.js); this
--                    is what stops a client that does not.
--
-- Additive: two nullable columns, a new table, a trigger. Existing rows are
-- not touched here; locations_map_listings.sql fills their location_id.
-- Undo: supabase/rollback_locations.sql.

create table public.locations (
  id            text primary key,
  type          text not null check (type in ('qark', 'bashki', 'njesi', 'lagje', 'fshat', 'zone')),
  parent_id     text references public.locations(id),
  bashki_id     text references public.locations(id),
  slug          text not null,
  name          text not null,
  name_definite text,
  names         jsonb not null default '{}'::jsonb,
  search_keys   text[] not null default '{}',
  lat           double precision,
  lng           double precision,
  -- [minLat, minLng, maxLat, maxLng] of the outline (qark, bashki, njesi).
  bbox          double precision[] check (bbox is null or cardinality(bbox) = 4),
  postal_code   text,
  -- For a bashki: the city name the apps store for it (its seat town).
  app_city      text,
  -- A zone the apps' pickers offer under its municipality.
  offered       boolean not null default false,
  source        jsonb not null default '{}'::jsonb,
  constraint locations_in_albania check (lat is null or (lat between 39.6 and 42.7 and lng between 19.2 and 21.1)),
  constraint locations_app_city_is_bashki check (app_city is null or type = 'bashki')
);
comment on table public.locations is 'Real Albanian places (docs/locations/SOURCES.md). Read by everyone; written by migrations and moderators.';

create unique index locations_app_city_key on public.locations (app_city) where app_city is not null;
create unique index locations_offered_zone_key on public.locations (bashki_id, name) where offered;
create index locations_parent_id_idx on public.locations (parent_id);
create index locations_bashki_id_idx on public.locations (bashki_id);

alter table public.locations enable row level security;
create policy "Anyone reads locations" on public.locations
  for select to anon, authenticated using (true);
create policy "Moderators add locations" on public.locations
  for insert to authenticated with check ((select public.is_moderator()));
create policy "Moderators change locations" on public.locations
  for update to authenticated using ((select public.is_moderator())) with check ((select public.is_moderator()));
create policy "Moderators remove locations" on public.locations
  for delete to authenticated using ((select public.is_moderator()));
revoke all on public.locations from anon, authenticated;
grant select on public.locations to anon, authenticated;
grant insert, update, delete on public.locations to authenticated;

alter table public.properties add column location_id text references public.locations(id);
alter table public.wanted_homes add column location_id text references public.locations(id);
create index properties_location_id_idx on public.properties (location_id);
create index wanted_homes_location_id_idx on public.wanted_homes (location_id);

-- The guard. Errors carry check_violation (23514) and say what to fix.
create or replace function public.locations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.locations;
  z public.locations;
  margin constant double precision := 0.01;
begin
  new.zone := nullif(btrim(coalesce(new.zone, '')), '');
  if new.city is null or btrim(new.city) = '' then
    new.location_id := null;
  else
    select * into b from public.locations l where l.app_city = new.city;
    if not found then
      raise exception using errcode = '23514',
        message = format('Unknown city "%s"', new.city),
        hint = 'Choose a city from the list the apps offer (public.locations).';
    end if;
    if new.zone is not null then
      select * into z from public.locations l where l.bashki_id = b.id and l.offered and l.name = new.zone;
      if not found then
        raise exception using errcode = '23514',
          message = format('"%s" is not a zone of %s', new.zone, new.city),
          hint = 'Choose a zone from that city''s list, or none.';
      end if;
    end if;
    new.location_id := coalesce(z.id, b.id);
  end if;

  if new.latitude is not null and new.longitude is not null then
    if not (new.latitude between 39.6 and 42.7 and new.longitude between 19.2 and 21.1) then
      raise exception using errcode = '23514',
        message = 'The map pin is outside Albania',
        hint = 'Place the pin where the property is.';
    end if;
    if b.bbox is not null and not (
      new.latitude between b.bbox[1] - margin and b.bbox[3] + margin
      and new.longitude between b.bbox[2] - margin and b.bbox[4] + margin
    ) then
      raise exception using errcode = '23514',
        message = format('The map pin is outside the municipality of %s', new.city),
        hint = 'Move the pin, or choose the city the property is in.';
    end if;
  end if;
  return new;
end;
$$;

create trigger properties_locations_guard
  before insert or update of city, zone, latitude, longitude, location_id on public.properties
  for each row execute function public.locations_guard();
-- Wanted homes have a city and no zone or pin.
create or replace function public.locations_guard_city_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.locations;
begin
  select * into b from public.locations l where l.app_city = new.city;
  if not found then
    raise exception using errcode = '23514',
      message = format('Unknown city "%s"', new.city),
      hint = 'Choose a city from the list the apps offer (public.locations).';
  end if;
  new.location_id := b.id;
  return new;
end;
$$;

create trigger wanted_homes_locations_guard
  before insert or update of city, location_id on public.wanted_homes
  for each row execute function public.locations_guard_city_only();

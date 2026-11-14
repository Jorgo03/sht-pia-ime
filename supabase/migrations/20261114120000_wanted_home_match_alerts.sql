-- Tell a buyer when a listing matching their "wanted home" is published
-- (AUDIT-025). Not applied live without the owner's OK; the version is
-- renamed to the live one when it is (AUDIT-012 rule).
--
-- Before: wanted_homes were only shown on agents' dashboards (newest 10, any
-- city). Nothing reached the buyer who posted the request.
--
-- Now, when a listing becomes active (published, or back from paused/draft),
-- every open wanted home it fits gets one `wanted_match` notification through
-- queue_push: the in-app notification centre, plus a push if the buyer has a
-- device registered. The rules are the apps' own matchesWanted
-- (src/features/leads/lib/leads.js):
--   * city: accents ignored, final vowel ignored (Tiranë / Tirana / Tirane),
--     either name may contain the other; a wanted home without a city fits any
--     (since the locations work both sides hold canonical names from
--     public.locations, so in practice the names are equal);
--   * sale or rent must be the same;
--   * budget is in euros (ALL 98 and USD 1.15 per euro, as priceRange.js);
--   * bedrooms are a minimum; a listing that does not say does not fit one.
-- Never the publisher's own wanted homes, never a listing on moderation hold.
-- One notification per wanted home and listing (dedupe key), so pausing and
-- re-publishing does not notify twice. At most 500 buyers per listing.
-- A failure here never blocks publishing (same rule as push_on_viewing).
-- Tests: supabase/tests/rls_wanted_match.sql.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'inquiry', 'viewing_requested', 'viewing_updated',
  'listing_hidden', 'listing_restored', 'welcome', 'announcement', 'saved_search',
  'wanted_match'
));

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in (
  'message', 'inquiry', 'viewing_requested', 'viewing_updated',
  'listing_hidden', 'listing_restored', 'welcome', 'announcement', 'saved_search',
  'wanted_match'
));

-- Lower-case, accents folded, final vowel dropped: the apps' placeStem.
create or replace function public.place_stem(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(p, ''))),
      'ëéèêäáàâãïíìîöóòôõüúùûçñ',
      'eeeeaaaaaiiiiooooouuuucn'),
    '[aeiu]$', '')
$$;

create or replace function public.notify_wanted_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  price_eur numeric;
  listing_stem text := public.place_stem(new.city);
  wh record;
begin
  if new.status <> 'active' or coalesce(new.moderation_hold, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  price_eur := new.price / case coalesce(new.currency, 'EUR')
    when 'ALL' then 98 when 'USD' then 1.15 else 1 end;

  for wh in
    select w.id, w.client_id
    from public.wanted_homes w
    where coalesce(w.status, 'open') = 'open'
      and w.client_id is distinct from new.owner_id
      and w.client_id is distinct from new.agent_id
      and w.listing_type = new.listing_type
      and (
        public.place_stem(w.city) = ''
        or (listing_stem <> '' and (strpos(listing_stem, public.place_stem(w.city)) > 0
                            or strpos(public.place_stem(w.city), listing_stem) > 0))
      )
      and (w.max_price is null or w.max_price <= 0 or price_eur <= w.max_price)
      and (w.min_bedrooms is null or w.min_bedrooms <= 0 or coalesce(new.beds, -1) >= w.min_bedrooms)
    order by w.created_at
    limit 500
  loop
    perform public.queue_push(
      wh.client_id,
      'wanted_match',
      jsonb_build_object('property_id', new.id, 'wanted_home_id', wh.id),
      'wm:' || wh.id::text || ':' || new.id::text
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.notify_wanted_matches() from public, anon, authenticated;

drop trigger if exists properties_notify_wanted_matches on public.properties;
create trigger properties_notify_wanted_matches
  after insert or update of status on public.properties
  for each row execute function public.notify_wanted_matches();

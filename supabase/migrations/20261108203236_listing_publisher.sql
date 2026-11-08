-- "Published by" on a listing (owner approved 2026-11-08; docs/PUBLISHED_BY_REPORT.md).
-- Client profiles are private (RLS), so a listing's page cannot read its
-- client publisher's name. This returns only what a listing shows, and only
-- for a listing the caller may see: no profile becomes readable.
-- Applied live as migration 20261108203236. Check: supabase/tests/rls_listing_publisher.sql.
create or replace function public.listing_publisher(p_property uuid)
returns table (kind text, full_name text, phone text, agency_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when pr.role = 'agent' then 'agent' else 'client' end,
    nullif(trim(pr.full_name), ''),
    -- The number typed on the listing, published on purpose; the account's
    -- number only when the listing has none.
    coalesce(nullif(trim(p.contact_phone), ''), nullif(trim(pr.phone), '')),
    -- Never an office for a client, whatever their profile holds.
    case when pr.role = 'agent' then nullif(trim(pr.agency_name), '') end
  from public.properties p
  join public.profiles pr on pr.id = p.owner_id
  where p.id = p_property
    and (
      p.status = 'active'
      or p.owner_id = (select auth.uid())
      or p.agent_id = (select auth.uid())
      or public.is_moderator()
    );
$$;

comment on function public.listing_publisher(uuid) is
  'Public contact details of a listing''s original publisher (owner_id): kind, name, phone, office for agents. Active listings only, unless the caller owns or moderates it.';

revoke all on function public.listing_publisher(uuid) from public;
grant execute on function public.listing_publisher(uuid) to anon, authenticated;

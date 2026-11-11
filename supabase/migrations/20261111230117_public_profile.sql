-- Public profile of a person you meet in the app: the chat header and agent
-- links open it (app/user/[id].tsx; src/features/profiles/lib/publicProfile.js).
--
-- Client profiles are private (RLS on profiles), so this returns only what a
-- public profile shows, and only when there is a reason to show it:
--   * the person is an agent (agent profiles are already public), or
--   * it is yourself, or
--   * you share a conversation with them, in either role. The profiles policy
--     only lets the agent side read the client, so a client writing to a client
--     who published a listing could not see who they were talking to, or
--   * they publish at least one active listing, whose page already shows their
--     name and phone (listing_publisher, migration 20261108203236).
-- Otherwise no row. No profile becomes readable through the table itself, and
-- nothing beyond name, photo, account type, phone and an agent's office leaves
-- the database: no email, bio, language, dates or statistics.
--
-- The phone follows listing_publisher when the only reason is a listing: the
-- number typed on their newest active listing, else the account's. Someone you
-- talk to, and yourself, see the account's number. A client never has an office,
-- whatever the profile holds. The photo is shown to people with a conversation
-- or to anyone for agents, never just because of a listing.
--
-- The listings themselves are read from `properties` by the app, so the
-- table's own policy (active, unless yours) still decides what is visible.
-- Check: supabase/tests/rls_public_profile.sql.

create or replace function public.public_profile(p_user uuid)
returns table (
  id uuid,
  kind text,
  full_name text,
  avatar_url text,
  phone text,
  agency_name text,
  listing_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select (select auth.uid()) as uid
  ),
  live as (
    select p.contact_phone, p.created_at
    from public.properties p
    where (p.owner_id = p_user or p.agent_id = p_user)
      and p.status = 'active'
  ),
  person as (
    select
      pr.*,
      (
        pr.role = 'agent'
        or pr.id = (select uid from viewer)
        or exists (
          select 1 from public.conversations c
          where (c.client_id = pr.id and c.agent_id = (select uid from viewer))
             or (c.agent_id = pr.id and c.client_id = (select uid from viewer))
        )
        or public.is_moderator()
      ) as known,
      exists (select 1 from live) as publishes
    from public.profiles pr
    where pr.id = p_user
  )
  select
    pe.id,
    case when pe.role = 'agent' then 'agent' else 'client' end,
    nullif(trim(pe.full_name), ''),
    case when pe.known then nullif(trim(pe.avatar_url), '') end,
    case
      when pe.known then nullif(trim(pe.phone), '')
      else coalesce(
        (select nullif(trim(l.contact_phone), '') from live l order by l.created_at desc limit 1),
        nullif(trim(pe.phone), '')
      )
    end,
    case when pe.role = 'agent' then nullif(trim(pe.agency_name), '') end,
    (select count(*) from live)
  from person pe
  where pe.known or pe.publishes;
$$;

comment on function public.public_profile(uuid) is
  'Public card of a person: kind, name, photo, phone, office for agents, active listing count. Only for agents, yourself, someone you share a conversation with, or a publisher of an active listing.';

revoke all on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to anon, authenticated;

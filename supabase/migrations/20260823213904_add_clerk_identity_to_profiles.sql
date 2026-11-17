-- Recovered from production's supabase_migrations.schema_migrations on
-- 2026-10-07; it was applied there but never committed. Part of the Clerk
-- migration that 20260824141153_revert_clerk_migration later undoes.

-- Foundation for migrating authentication to Clerk while Supabase keeps the
-- database. Deliberately additive: nothing here changes existing behaviour,
-- so the live web app (still on Supabase Auth) is unaffected.
--
-- Why profiles.id is NOT replaced: every foreign key in the schema points at
-- public.profiles.id (11 columns across conversations, favorites, leads,
-- messages, properties, property_views, saved_searches, viewings,
-- wanted_homes). None reference auth.users directly. Keeping profiles.id as
-- the internal primary key means zero data movement and no FK churn; Clerk
-- identity is carried alongside it instead.
alter table public.profiles
  add column if not exists clerk_user_id text;

-- Partial unique index rather than a UNIQUE constraint: existing rows are all
-- NULL until they are linked, and NULLs must not collide.
create unique index if not exists profiles_clerk_user_id_key
  on public.profiles (clerk_user_id)
  where clerk_user_id is not null;

comment on column public.profiles.clerk_user_id is
  'Clerk user id (JWT "sub", e.g. user_2abc...). NULL for accounts that still authenticate through Supabase Auth. Populated during the Clerk migration; profiles.id remains the internal FK target.';

-- Resolves the caller to a profiles.id regardless of which auth system issued
-- the token, so RLS policies do not need to know the difference.
--
-- The UUID guard is load-bearing: auth.uid() casts the JWT "sub" claim to
-- uuid, and Clerk subs look like 'user_2abc...'. Calling auth.uid() on a Clerk
-- token therefore raises 22P02 (invalid input syntax for type uuid) and fails
-- the whole query rather than returning NULL — so the shape must be checked
-- before the cast is ever attempted.
create or replace function public.current_profile_id()
returns uuid
language plpgsql
security definer
stable
set search_path = 'public'
as $$
declare
  claim text;
  resolved uuid;
begin
  claim := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
  if claim is null then
    return null;
  end if;

  -- Supabase Auth: sub is the auth.users UUID, which is also profiles.id.
  if claim ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return claim::uuid;
  end if;

  -- Clerk: map the opaque sub onto the profile that claims it.
  select p.id into resolved from public.profiles p where p.clerk_user_id = claim;
  return resolved;
end;
$$;

-- Same posture as the existing current_user_is_agent()/claim_role() helpers:
-- reachable by signed-in callers only, never by anon.
revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated;

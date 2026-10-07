-- Recovered from production's supabase_migrations.schema_migrations on
-- 2026-10-07; it was applied there but never committed. Part of the Clerk
-- migration that 20260824141153_revert_clerk_migration later undoes.

-- Lets a profile exist without a Supabase Auth user, and provides the
-- server-only routine that links a Clerk identity to one.

-- 1. profiles.id referenced auth.users(id), so a Clerk-only user could not
--    have a profile at all — the insert failed the FK. Dropping it is the
--    point of the migration: the database must not require a Supabase Auth
--    row for normal operation.
--
--    Trade-off, stated plainly: this also drops ON DELETE CASCADE, so
--    deleting an auth.users row no longer removes its profile. That cascade
--    stops being meaningful once Clerk owns identity, and account deletion
--    will be handled through Clerk instead. Existing rows are unaffected —
--    removing a constraint cannot invalidate data that already satisfied it.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Link-on-first-sign-in.
--
--    Called ONLY by the clerk-link-profile Edge Function, which has already
--    verified the Clerk JWT against Clerk's JWKS and fetched the e-mail from
--    Clerk's Backend API. The e-mail argument is therefore provider-verified,
--    never client-supplied — that distinction is the whole security model
--    here. If a caller could pass an arbitrary e-mail, it could claim another
--    person's profile (and with it their listings and agent role).
--
--    Hence the grants at the bottom: service_role only. anon and
--    authenticated must never reach this.
create or replace function public.link_clerk_profile(
  p_clerk_id text,
  p_email text,
  p_full_name text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  result public.profiles;
  matched_id uuid;
begin
  if p_clerk_id is null or length(trim(p_clerk_id)) = 0 then
    raise exception 'clerk id is required';
  end if;

  -- Already linked: idempotent, and the common path on every later sign-in.
  select * into result from public.profiles where clerk_user_id = p_clerk_id;
  if found then
    return result;
  end if;

  -- Existing Supabase Auth account with the same verified e-mail: adopt it so
  -- the user keeps their favourites, listings, messages and role.
  if p_email is not null then
    select u.id into matched_id
    from auth.users u
    where lower(u.email) = lower(p_email)
    limit 1;
  end if;

  if matched_id is not null then
    update public.profiles
    set clerk_user_id = p_clerk_id,
        -- Never overwrite what the user already set; only fill blanks.
        full_name = coalesce(full_name, p_full_name),
        avatar_url = coalesce(avatar_url, p_avatar_url),
        updated_at = now()
    where id = matched_id
    returning * into result;

    if found then
      return result;
    end if;
  end if;

  -- Brand-new user. role is hard-coded to 'buyer': the caller does not get to
  -- choose it, which preserves the existing no-self-promotion model
  -- (claim_role remains the only path to 'agent').
  insert into public.profiles (id, clerk_user_id, full_name, avatar_url, role, preferred_language)
  values (gen_random_uuid(), p_clerk_id, p_full_name, p_avatar_url, 'buyer', 'sq')
  on conflict (clerk_user_id) where clerk_user_id is not null do nothing
  returning * into result;

  -- Lost a race with a concurrent sign-in: the other call inserted first.
  if result is null then
    select * into result from public.profiles where clerk_user_id = p_clerk_id;
  end if;

  return result;
end;
$$;

revoke all on function public.link_clerk_profile(text, text, text, text) from public;
revoke all on function public.link_clerk_profile(text, text, text, text) from anon;
revoke all on function public.link_clerk_profile(text, text, text, text) from authenticated;
grant execute on function public.link_clerk_profile(text, text, text, text) to service_role;

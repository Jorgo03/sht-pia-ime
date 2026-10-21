-- Let people change their own profile photo (docs/LAUNCH_TASKS.md F12).
-- Applied 2026-10-21 as 20261021003934, after a rolled-back live test of the
-- same statements passed 9/9 (supabase/tests/rls_profile_avatar.sql).
--
-- Today avatar_url is not writable by the apps at all; the only avatars are
-- the Google ones copied in at sign-up by handle_new_user (which runs as the
-- table owner and is not affected by anything here).
--
-- 1. Column grant: UPDATE (avatar_url) to authenticated. Which ROW may change
--    is still decided by "Users can update own profile" (auth.uid() = id).
-- 2. Guard: from the apps, avatar_url may only be cleared or set to a file in
--    the caller's own folder of this project's public `avatars` bucket. That
--    stops a profile photo from becoming an arbitrary third-party URL (a
--    tracking pixel, or someone else's file). The bucket already limits files
--    to 2 MB of JPEG/PNG/WebP and each user to their own folder.
--    The project host is spelled out because it is the only allowed origin; a
--    custom storage domain later means updating this function.
--
-- Rollback:
--   revoke update (avatar_url) on public.profiles from authenticated;
--   drop trigger profiles_guard_avatar on public.profiles;
--   drop function public.guard_profile_avatar();

grant update (avatar_url) on public.profiles to authenticated;

create or replace function public.guard_profile_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and new.avatar_url !~ (
       '^https://xzzzhlwmzotibrxdqmcm\.supabase\.co/storage/v1/object/public/avatars/'
       || new.id::text || '/[A-Za-z0-9._-]{1,100}$'
     ) then
    raise exception 'avatar_url must be a photo in your own avatars folder'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_avatar
  before update on public.profiles
  for each row execute function public.guard_profile_avatar();

revoke execute on function public.guard_profile_avatar() from public, anon, authenticated;

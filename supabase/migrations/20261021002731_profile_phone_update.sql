-- Applied 2026-10-21 as migration 20261021002731, under the owner's "go" in
-- the completion prompt (docs/LAUNCH_TASKS.md L12). Verified after applying:
-- authenticated may update phone, still not role.
--
-- Lets a signed-in user change their own phone number, which "Edit profile"
-- (web Profile page, phone Profile tab) offers. Today `profiles` UPDATE is
-- granted only on full_name, agency_name and preferred_language, so an agent
-- whose number changed has no way to fix it, and every listing and agent page
-- keeps showing the old one.
--
-- Scope, deliberately small:
--   * one column grant: UPDATE (phone) to authenticated. Which ROW a user may
--     update is unchanged: the existing policy "Users can update own profile"
--     (auth.uid() = id) still decides that. role stays ungranted.
--   * one CHECK so the column only ever holds a phone-shaped value (the same
--     rule as isValidPhone() in src/features/auth/lib/profileForm.js). Added
--     NOT VALID and then validated, so it fails loudly instead of rewriting
--     anything if an existing row does not fit. On 2026-10-20 one row had a
--     phone and it fits.
-- Not included: avatar_url (needs an upload flow and a storage path rule) and
-- bio (not readable by signed-out visitors, so it has nowhere to show yet).
--
-- Tested live on 2026-10-20 inside a rolled-back transaction: see
-- supabase/tests/README.md. Rollback after applying:
--   revoke update (phone) on public.profiles from authenticated;
--   alter table public.profiles drop constraint profiles_phone_format;

alter table public.profiles
  add constraint profiles_phone_format
  check (phone is null or (phone ~ '^\+?[0-9 ()-]{6,32}$' and length(regexp_replace(phone, '\D', '', 'g')) >= 6))
  not valid;
alter table public.profiles validate constraint profiles_phone_format;

grant update (phone) on public.profiles to authenticated;

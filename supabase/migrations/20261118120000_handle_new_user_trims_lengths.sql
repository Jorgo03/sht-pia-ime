-- REGISTRATION_FAILURE_AUDIT.md RC4.
--
-- 20261104215248_server_form_checks added profiles_full_name_length and
-- profiles_agency_name_length (<= 80 characters). handle_new_user() copies
-- full_name and agency_name from the sign-up metadata unchanged, and it runs
-- as an AFTER INSERT trigger on auth.users: a name or office of 81+
-- characters violates the constraint, rolls back the new auth user, and
-- Supabase answers 500 "Database error saving new user". This is the failure
-- class 20260903213714_handle_new_user_cannot_abort_signup ruled out; the later
-- constraint brought it back.
--
-- The function now trims both to the constraint's limit and turns blank
-- values into NULL, so sign-up metadata can never abort a registration. The
-- constraints stay the source of truth for later edits. Everything else is
-- unchanged from the live definition read on 2026-11-18: role is 'agent' only
-- when asked for, otherwise 'buyer'; the office is kept for agents only;
-- unknown languages fall back to 'sq'; an existing profile is left alone.
--
-- No rows change: this replaces a function only. Rollback: re-run the
-- definition in 20260903213714_handle_new_user_cannot_abort_signup.sql.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role, agency_name, preferred_language)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')), 80), ''),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'role' = 'agent' then 'agent' else 'buyer' end,
    case when new.raw_user_meta_data->>'role' = 'agent'
         then nullif(left(btrim(new.raw_user_meta_data->>'agency_name'), 80), '') else null end,
    case when new.raw_user_meta_data->>'preferred_language'
              in ('sq','en','de','it','es','pl','ru','fr')
         then new.raw_user_meta_data->>'preferred_language' else 'sq' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Restated as in 20260903213714: only the trigger may run this function.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

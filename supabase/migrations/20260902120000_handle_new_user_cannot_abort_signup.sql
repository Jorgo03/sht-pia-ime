-- handle_new_user() ran as an AFTER INSERT trigger on auth.users, so anything
-- it rejects rolls back the auth.users row with it: GoTrue answers 500 and the
-- account is never created at all. Two of the values it forwarded from
-- client-supplied raw_user_meta_data could be rejected by the destination
-- column, which turned a bad metadata value into a failed registration rather
-- than a harmless default.
--
--   role               the whitelist accepted 'client', which
--                      profiles_role_check has never allowed
--                      (CHECK role IN ('buyer','agent')). Between 2026-07-02
--                      and 2026-08-11 the website's role toggle defaulted to
--                      'client', so ordinary registrations 500'd for five
--                      weeks. The frontend was fixed; this half never was.
--
--   preferred_language was forwarded with no membership test at all, while
--                      profiles_preferred_language_check accepts exactly eight
--                      codes. Any other value — a regional code like 'en-US'
--                      from a client that does not normalise, or a future
--                      locale added to the UI before the constraint — destroys
--                      the signup instead of falling back.
--
-- Both now degrade to the column's own default. A signup must never be lost to
-- an unexpected metadata value; the constraints stay as the source of truth for
-- what is allowed, and this function is simply incapable of violating them.
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
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'role' = 'agent' then 'agent' else 'buyer' end,
    case when new.raw_user_meta_data->>'role' = 'agent'
         then new.raw_user_meta_data->>'agency_name' else null end,
    case when new.raw_user_meta_data->>'preferred_language'
              in ('sq','en','de','it','es','pl','ru','fr')
         then new.raw_user_meta_data->>'preferred_language' else 'sq' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The grants the previous definition carried, restated because CREATE OR
-- REPLACE resets them.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

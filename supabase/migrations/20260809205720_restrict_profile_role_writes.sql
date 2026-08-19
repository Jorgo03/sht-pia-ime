-- C1 remediation: profiles.role is currently writable by any authenticated
-- (and anon) user via a plain UPDATE, and wanted_homes' agent-read policy
-- trusts that same column — so any signed-in user could self-promote to
-- 'agent' and read every buyer's wanted_homes row.
--
-- handle_new_user() already seeds role correctly from signup metadata for
-- password signups. The one legitimate remaining need for a client-side role
-- write is the OAuth flow: supabase.auth.signInWithOAuth() cannot carry the
-- role the user picked before redirecting to the provider, so the app stores
-- it in localStorage and applies it once, right after the OAuth callback
-- (AuthContext.jsx applyPendingRole). This function replaces that raw
-- `.update({ role })` with a narrow, time-boxed claim.

create or replace function public.claim_role(new_role text)
returns public.profiles
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  result public.profiles;
begin
  if new_role not in ('agent', 'buyer') then
    raise exception 'invalid role: %', new_role;
  end if;

  -- Row lock avoids a races with a concurrent claim_role call for the same
  -- user; 5-minute window mirrors the isNewAccount check the client already
  -- had, so behavior is unchanged for the one legitimate caller (OAuth
  -- post-signup), just no longer reachable from an established session.
  select * into result from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'no profile for current user';
  end if;

  if result.created_at < now() - interval '5 minutes' then
    raise exception 'role claim window has expired';
  end if;

  update public.profiles
  set role = new_role
  where id = auth.uid()
  returning * into result;

  return result;
end;
$$;

-- SECURITY DEFINER runs as the function owner regardless of the caller's own
-- grants, so this authorizes the *function*, not column access.
revoke all on function public.claim_role(text) from public;
grant execute on function public.claim_role(text) to authenticated;

-- The vulnerability itself: remove the caller's ability to write role (or
-- id/created_at) directly. anon has no legitimate profiles write at all.
revoke update (role, id, created_at) on public.profiles from authenticated;
revoke all on public.profiles from anon;

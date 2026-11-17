-- Security audit L1: `buyer_has_open_wanted_home(uuid)` is SECURITY DEFINER,
-- takes an ARBITRARY user id, and was callable by `anon` over /rest/v1/rpc/.
-- Inside the `profiles` SELECT policy it is correctly gated behind
-- `current_user_is_agent()`, but a direct RPC call skipped that gate — letting
-- an unauthenticated caller probe any uuid and learn whether that person has
-- an open wanted-home request. No client code calls this RPC (verified across
-- src/, app/, components/, lib/, hooks/, contexts/ — zero call sites).
--
-- FIRST ATTEMPT, REVERTED: `revoke execute ... from anon`, mirroring
-- 20260819213249_revoke_anon_execute_on_claim_role.sql.
-- That BROKE public agent profiles. RLS evaluates a policy's function calls as
-- the *calling* role, and the profiles SELECT policy ends with
--   (current_user_is_agent() AND buyer_has_open_wanted_home(id))
-- Postgres did not short-circuit the AND, so every anonymous read of profiles
-- failed with `42501 permission denied for function
-- buyer_has_open_wanted_home`. Caught by testing anon profile reads
-- immediately after applying, and rolled back in the same session.
--
-- WHAT SHIPPED INSTEAD: keep the grant so the policy still evaluates, and move
-- the gate inside the function. The profiles policy already ANDs this with
-- current_user_is_agent(), so gating on the same condition changes no policy
-- outcome — but a direct RPC call from anon (or any non-agent) now returns a
-- constant false instead of a real answer about an arbitrary user.
--
-- Verified after applying:
--   anon GET /rest/v1/profiles              -> 200, 5 rows   (regression gone)
--   anon POST /rpc/buyer_has_open_wanted_home -> 200, `false` (oracle closed)

grant execute on function public.buyer_has_open_wanted_home(uuid) to anon;

create or replace function public.buyer_has_open_wanted_home(target_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  -- Only agents may learn this. Non-agents and anonymous callers get false
  -- regardless of target_id, so the RPC is no longer an information oracle.
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'agent'
  ) then
    return false;
  end if;

  return exists (
    select 1 from public.wanted_homes where client_id = target_id and status = 'open'
  );
end;
$function$;

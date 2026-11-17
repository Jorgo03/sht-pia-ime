-- Already applied to production on 2026-09-08 through the Supabase management
-- API; committed afterwards so the repository reproduces the live database.
-- Without this file, any environment rebuilt from these migrations (a branch,
-- a staging project, disaster recovery) would silently reopen the hole below.
-- Every statement is idempotent, so re-running it against production is a
-- no-op rather than an error.
--
-- prune_property_activity is SECURITY DEFINER and DELETEs from
-- property_activity. Its ACL carried a grant to PUBLIC (the leading
-- "=X/postgres" entry), which includes anon and authenticated, and PostgREST
-- exposes every public-schema function as an RPC -- so any anonymous caller
-- could POST /rest/v1/rpc/prune_property_activity and destroy activity
-- history. The retain_days >= 30 guard caps the damage, it does not prevent it.
-- No client calls this function; it is administrative work run as service_role.
REVOKE EXECUTE ON FUNCTION public.prune_property_activity(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_property_activity(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prune_property_activity(integer) FROM authenticated;

-- Recovered from production's supabase_migrations.schema_migrations on
-- 2026-10-07; it was applied there but never committed. Superseded six minutes
-- later by 20260830161507_guard_wanted_home_oracle_instead_of_revoking, which
-- guards the function's body instead of revoking access.
revoke execute on function public.buyer_has_open_wanted_home(uuid) from anon;

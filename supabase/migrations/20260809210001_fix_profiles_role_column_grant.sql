-- The prior migration's `revoke update (role, id, created_at) ... from
-- authenticated` had NO effect: Supabase's default setup grants
-- `authenticated` a TABLE-WIDE UPDATE (GRANT ALL ON ALL TABLES IN SCHEMA
-- public), which implicitly covers every column. A column-level REVOKE only
-- removes a column-specific grant entry — it does not narrow a broader
-- table-wide grant that's still in effect. Confirmed live: a simulated
-- authenticated UPDATE of role still succeeded after that migration.
--
-- The correct primitive is the other direction: revoke the table-wide UPDATE
-- entirely, then grant UPDATE back only on the columns a user should ever be
-- able to write themselves. Swept both codebases (web + RN) for every
-- .update()/.upsert() call touching public.profiles — the complete list of
-- client-written columns is full_name, agency_name, preferred_language.
-- Deliberately excluded even though present in the schema: role (the
-- vulnerability), id/created_at (identity/audit), avatar_url/phone/bio (no
-- UI writes them today — add explicitly if a profile-edit screen needs them,
-- rather than leaving them open by default).

revoke update on public.profiles from authenticated;
grant update (full_name, agency_name, preferred_language) on public.profiles to authenticated;

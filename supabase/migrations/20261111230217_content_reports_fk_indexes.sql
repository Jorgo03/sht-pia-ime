-- Covering indexes for content_reports' three foreign keys (Supabase advisor
-- 0001 unindexed_foreign_keys, launch audit 2026-11-12). Without them a
-- delete of a listing or an account scans the whole reports table to find
-- referencing rows, and the moderation queue's lookups by listing or person
-- do the same. Applied live as migration 20261111230217.
create index if not exists content_reports_property_id_idx on public.content_reports (property_id);
create index if not exists content_reports_reported_user_id_idx on public.content_reports (reported_user_id);
create index if not exists content_reports_reviewed_by_idx on public.content_reports (reviewed_by);

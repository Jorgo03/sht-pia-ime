-- Serves the project-wide daily AI ceiling (docs/LAUNCH_TASKS.md F1): each AI
-- Edge Function counts its own feature's calls over the last 24 hours across
-- every caller. The existing (key, feature, created_at) index cannot serve a
-- count that does not filter on key. Applied 2026-10-21. Additive.
create index if not exists ai_usage_feature_created_idx on public.ai_usage (feature, created_at);

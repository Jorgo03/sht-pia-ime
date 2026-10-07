-- Already applied to production on 2026-09-08 through the Supabase management
-- API; committed afterwards so the repository reproduces the live database.
-- IF NOT EXISTS makes re-running it against production a no-op.
--
-- Postgres does not index the referencing side of a foreign key, so each of
-- these was a sequential scan on a column the app filters by.
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_property_activity_user_id
  ON public.property_activity (user_id);

CREATE INDEX IF NOT EXISTS idx_property_views_user_id
  ON public.property_views (user_id);

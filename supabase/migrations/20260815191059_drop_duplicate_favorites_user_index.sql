-- idx_favorites_user and idx_favorites_user_id are byte-for-byte identical
-- (both: CREATE INDEX ... ON public.favorites USING btree (user_id)),
-- confirmed via pg_indexes before this migration. Keeping the
-- idx_<table>_<column> named one to match the sibling idx_favorites_property_id.
DROP INDEX IF EXISTS public.idx_favorites_user;

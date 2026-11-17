-- Signed-out visitors lose table grants they never use (AUDIT-017).
--
-- Supabase grants every new public table to `anon` by default, so tables like
-- payment_events and ai_usage were open to signed-out requests at the grant
-- level and protected by row-level security alone. RLS held (27/27 anonymous
-- inserts refused, supabase/tests/rls_full_matrix.sql); this removes the
-- second layer's gap, so one mistaken policy cannot expose them.
--
-- What signed-out visitors still need, and keep:
--   properties          SELECT  (browse, search, listing pages)
--   plans               SELECT  (the website's pricing page)
--   property_activity   INSERT  (view counts; RLS limits what it accepts)
--   profiles, client_errors: already column-level grants, unchanged.
-- Every query on the other tables runs only for a signed-in user in both
-- apps, so they see no change. RPC functions are not touched here.
-- Tests: supabase/tests/rls_anon_grants.sql.

revoke all on table
  public.agency_subscriptions,
  public.ai_usage,
  public.conversations,
  public.favorites,
  public.leads,
  public.listing_promotions,
  public.messages,
  public.payment_events,
  public.property_views,
  public.saved_searches,
  public.viewings,
  public.wanted_homes
from anon;

revoke insert, update, delete, truncate, references, trigger on table public.properties from anon;
revoke insert, update, delete, truncate, references, trigger on table public.plans from anon;
revoke select, update, delete, truncate, references, trigger on table public.property_activity from anon;

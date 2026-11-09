-- Saved-search alerts through the notification centre and push (owner approved
-- the feature 2026-11-09; docs/COMPETITOR_ANALYSIS_CATIA.md). Adds the
-- notification kind and runs the saved-search-alerts Edge Function every 15
-- minutes. Honours the same off switch as all push:
--   update public.push_settings set enabled = false;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'inquiry', 'viewing_requested', 'viewing_updated',
  'listing_hidden', 'listing_restored', 'welcome', 'announcement', 'saved_search'
));

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in (
  'message', 'inquiry', 'viewing_requested', 'viewing_updated',
  'listing_hidden', 'listing_restored', 'welcome', 'announcement', 'saved_search'
));

-- Only the scheduled Edge Function records these.
grant execute on function public.queue_push(uuid, text, jsonb, text) to service_role;

create function public.request_saved_search_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  if not coalesce((select enabled from public.push_settings), false) then return; end if;
  if not exists (select 1 from public.saved_searches where alerts_enabled or email_alerts) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  perform net.http_post(
    url := 'https://xzzzhlwmzotibrxdqmcm.supabase.co/functions/v1/saved-search-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
exception when others then
  null;  -- the next run picks up anything missed
end;
$$;
revoke all on function public.request_saved_search_alerts() from public, anon, authenticated;

select cron.schedule('saved-search-alerts', '*/15 * * * *', 'select public.request_saved_search_alerts()');

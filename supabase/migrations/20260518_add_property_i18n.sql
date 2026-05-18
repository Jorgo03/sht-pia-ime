alter table public.properties
  add column if not exists title_i18n jsonb default '{}'::jsonb,
  add column if not exists description_i18n jsonb default '{}'::jsonb;

-- Backfill from old plain-text columns (safe to re-run)
update public.properties
  set title_i18n = jsonb_build_object('sq', title)
  where title is not null and (title_i18n is null or title_i18n = '{}'::jsonb);

update public.properties
  set description_i18n = jsonb_build_object('sq', description)
  where description is not null and (description_i18n is null or description_i18n = '{}'::jsonb);

create index if not exists idx_properties_title_i18n on public.properties using gin (title_i18n);
create index if not exists idx_properties_description_i18n on public.properties using gin (description_i18n);

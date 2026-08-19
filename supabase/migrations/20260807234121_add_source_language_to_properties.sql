-- Records which language the agent actually wrote the listing in, so the
-- other entries in title_i18n/description_i18n can be disclosed as machine
-- translations (a "Translated" badge) rather than passed off as original text.
alter table public.properties
  add column if not exists source_language text not null default 'sq';

alter table public.properties
  add constraint properties_source_language_check
  check (source_language in ('sq','en','de','it','es','pl','ru','fr'));

comment on column public.properties.source_language is
  'Language the listing was originally authored in; all other keys in title_i18n/description_i18n are AI translations.';

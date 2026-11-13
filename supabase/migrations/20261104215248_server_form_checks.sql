-- Every form is checked on the server, not only in the app (owner, 2026-11-04).
-- The apps write straight to these tables through the Supabase API, so a
-- request sent around the app's own checks used to reach the database with
-- any length or number. These CHECK constraints refuse it there. Limits are
-- the forms' own (src/lib/formLimits.js, src/features/auth/lib/profileForm.js,
-- src/features/leads/lib/leads.js, app/listing/new.tsx); tests/formLimits.test.mjs
-- keeps them in step. Choices (types, statuses, languages, report reasons),
-- phone formats and push tokens were already checked by earlier migrations.
-- Re-runnable: each constraint is dropped first.

-- True when every link is https (CHECK cannot hold a subquery, a function can).
create or replace function public.all_https(urls text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(u ~ '^https://'), true) from unnest(urls) as u
$$;

-- Listings (the listing form).
alter table public.properties
  drop constraint if exists properties_title_check,
  drop constraint if exists properties_description_length,
  drop constraint if exists properties_address_length,
  drop constraint if exists properties_city_length,
  drop constraint if exists properties_price_range,
  drop constraint if exists properties_sqft_range,
  drop constraint if exists properties_beds_range,
  drop constraint if exists properties_baths_range,
  drop constraint if exists properties_floor_range,
  drop constraint if exists properties_total_floors_range,
  drop constraint if exists properties_year_built_range,
  drop constraint if exists properties_currency_check,
  drop constraint if exists properties_images_check,
  drop constraint if exists properties_video_https,
  drop constraint if exists properties_contact_email_format,
  drop constraint if exists properties_contact_phone_format,
  drop constraint if exists properties_location_range;

alter table public.properties
  add constraint properties_title_check
    check (char_length(title) <= 200 and (status = 'draft' or btrim(title) <> '')),
  add constraint properties_description_length check (description is null or char_length(description) <= 10000),
  add constraint properties_address_length check (char_length(address) <= 300),
  add constraint properties_city_length check (city is null or char_length(city) <= 80),
  add constraint properties_price_range check (price > 0 and price <= 999999999),
  add constraint properties_sqft_range check (sqft is null or sqft between 1 and 100000),
  add constraint properties_beds_range check (beds is null or beds between 0 and 50),
  add constraint properties_baths_range check (baths is null or baths between 0 and 50),
  add constraint properties_floor_range check (floor is null or floor between -10 and 200),
  add constraint properties_total_floors_range check (total_floors is null or total_floors between 1 and 200),
  add constraint properties_year_built_range check (year_built is null or year_built between 1800 and 2100),
  add constraint properties_currency_check check (currency is null or currency in ('EUR', 'ALL', 'USD')),
  add constraint properties_images_check check (cardinality(image_urls) <= 20 and public.all_https(image_urls)),
  add constraint properties_video_https check (video_url is null or video_url = '' or video_url ~ '^https://'),
  add constraint properties_contact_email_format
    check (contact_email is null or contact_email = ''
      or (char_length(contact_email) <= 254 and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  add constraint properties_contact_phone_format
    check (contact_phone is null or btrim(contact_phone) = ''
      or (btrim(contact_phone) ~ '^\+?[0-9 ()-]{6,32}$' and length(regexp_replace(contact_phone, '\D', '', 'g')) >= 6)),
  add constraint properties_location_range
    check ((latitude is null or latitude between -90 and 90) and (longitude is null or longitude between -180 and 180));

-- Chat messages.
alter table public.messages drop constraint if exists messages_body_length;
alter table public.messages
  add constraint messages_body_length check (char_length(btrim(body)) between 1 and 4000);

-- Viewing requests.
alter table public.viewings
  drop constraint if exists viewings_notes_length,
  drop constraint if exists viewings_duration_range;
alter table public.viewings
  add constraint viewings_notes_length check (notes is null or char_length(notes) <= 1000),
  add constraint viewings_duration_range check (duration_minutes is null or duration_minutes between 15 and 480);

-- An agent's leads (the lead form).
alter table public.leads
  drop constraint if exists leads_name_length,
  drop constraint if exists leads_phone_length,
  drop constraint if exists leads_email_format,
  drop constraint if exists leads_notes_length;
alter table public.leads
  add constraint leads_name_length check (char_length(btrim(name)) between 1 and 120),
  add constraint leads_phone_length check (phone is null or char_length(phone) <= 32),
  add constraint leads_email_format
    check (email is null or email = '' or (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  add constraint leads_notes_length check (notes is null or char_length(notes) <= 2000);

-- "Wanted home" requests.
alter table public.wanted_homes
  drop constraint if exists wanted_homes_city_length,
  drop constraint if exists wanted_homes_notes_length,
  drop constraint if exists wanted_homes_max_price_range,
  drop constraint if exists wanted_homes_min_bedrooms_range;
alter table public.wanted_homes
  add constraint wanted_homes_city_length check (char_length(btrim(city)) between 1 and 80),
  add constraint wanted_homes_notes_length check (notes is null or char_length(notes) <= 2000),
  add constraint wanted_homes_max_price_range check (max_price is null or (max_price > 0 and max_price <= 999999999)),
  add constraint wanted_homes_min_bedrooms_range check (min_bedrooms is null or min_bedrooms between 0 and 50);

-- Saved searches.
alter table public.saved_searches
  drop constraint if exists saved_searches_name_length,
  drop constraint if exists saved_searches_filters_size;
alter table public.saved_searches
  add constraint saved_searches_name_length check (char_length(btrim(name)) between 1 and 120),
  add constraint saved_searches_filters_size check (octet_length(filters::text) <= 8000);

-- Profiles (the edit-profile form; phone format and language were checked already).
alter table public.profiles
  drop constraint if exists profiles_full_name_length,
  drop constraint if exists profiles_agency_name_length,
  drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 80),
  add constraint profiles_agency_name_length check (agency_name is null or char_length(agency_name) <= 80),
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 1000);

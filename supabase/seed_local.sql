-- =============================================================================
-- seed_local.sql — LOCAL DEVELOPMENT ONLY. NEVER RUN THIS AGAINST A REAL PROJECT.
-- =============================================================================
--
-- Populates a fresh local Supabase database (sht-pia-ime) with three logins and
-- twelve active Tirana listings, so a developer with no third-party credentials
-- (no OpenAI key, no live Supabase project, no uploaded photos) still opens the
-- app to a populated Home / Explore / Map screen.
--
-- It writes plaintext-derived passwords straight into auth.users. That is only
-- acceptable because the local stack is throwaway. Contains no API keys and no
-- service_role secrets — it is applied as the `postgres` superuser, which is
-- what bypasses RLS and the column-level grants on public.profiles.
--
-- -----------------------------------------------------------------------------
-- HOW TO APPLY
-- -----------------------------------------------------------------------------
--   Option A — one-off, against a running stack (does not touch config):
--     supabase start
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--       -v ON_ERROR_STOP=1 -f supabase/seed_local.sql
--
--   Option B — run automatically on every `supabase db reset`:
--     add "./seed_local.sql" to [db.seed] sql_paths in supabase/config.toml,
--     or symlink it:  ln -s seed_local.sql supabase/seed.sql
--     (config.toml already declares sql_paths = ["./seed.sql"], but that file
--      does not exist in the repo today, so `db reset` currently seeds nothing.)
--
-- Re-runnable: every statement is ON CONFLICT / NOT EXISTS guarded. Running it
-- twice refreshes the listing rows in place and creates no duplicates.
--
-- -----------------------------------------------------------------------------
-- LOGINS  (all three share the password: password123)
-- -----------------------------------------------------------------------------
--   demo@local.test    role=agent  Arben Hoxha    — owns 7 listings  <- main user
--   agent@local.test   role=agent  Elira Kola     — owns 5 listings
--   buyer@local.test   role=buyer  Sokol Meta     — has 3 favourites
--
-- -----------------------------------------------------------------------------
-- WHY THINGS ARE THE WAY THEY ARE (verified against supabase/migrations/)
-- -----------------------------------------------------------------------------
--  * status = 'active' on every listing. The SELECT policy on public.properties
--    ("Active properties viewable, owners see own") is
--      status = 'active' OR auth.uid() = owner_id OR auth.uid() = agent_id
--    so 'active' is the ONLY value a logged-out visitor can see. 'pending',
--    'pending_review', 'draft', 'paused', 'sold' and 'rented' are all invisible.
--    Flip one row to 'paused' by hand if you want to test the owner-only path.
--  * profiles rows are NOT inserted from scratch. The AFTER INSERT trigger
--    on_auth_user_created -> public.handle_new_user() already creates them from
--    raw_user_meta_data the moment a row lands in auth.users, so this file only
--    UPSERTs the columns that trigger never writes (phone, bio, avatar_url).
--  * raw_user_meta_data.role is only ever 'agent' or 'buyer'. handle_new_user()
--    also accepts 'client', but profiles_role_check allows only ('buyer','agent')
--    — a 'client' value aborts the auth.users insert with a CHECK violation.
--  * owner_id references auth.users(id); agent_id references public.profiles(id).
--    Both are set to the same uuid here, because app/agent/[id].tsx filters on
--    agent_id and the RLS INSERT policy checks owner_id.
--  * image_urls is text[] (not jsonb) — hence array[...]. The URLs are remote
--    Unsplash links, so no Storage upload and no property-images bucket objects
--    are required for images to render.
--  * title_i18n / description_i18n are flat jsonb maps ({"sq": "...", "en": "..."})
--    read by getLocalizedText(). Albanian is the source (source_language = 'sq').
--  * translation_meta carries a real cyrb53 sourceFingerprint() computed with the
--    app's own algorithm (src/lib/translationCore.js), so the English entries
--    classify as CURRENT rather than STALE and the UI never fires a translation
--    request — which matters precisely because you have no AI key locally.
--  * public.ai_usage is deliberately left empty: it is the rate-limit ledger for
--    the edge functions, and seeded rows would count against the quota.
--  * Nothing is written to saved_searches, leads, wanted_homes, viewings,
--    conversations, messages or property_views. No migration creates those tables
--    (they were made out-of-band in the dashboard), so their DDL is unknowable
--    from this repo and `supabase db reset` currently fails before reaching them.
--    If your local DB stops mid-migration, that missing DDL is the cause — not
--    this file.
-- =============================================================================

-- crypt()/gen_salt() live in the `extensions` schema on Supabase, in `public`
-- on a bare Postgres. Putting both on the search_path resolves it either way.
create extension if not exists pgcrypto;
set search_path = public, extensions;

begin;

-- -----------------------------------------------------------------------------
-- 1. AUTH USERS
--    Inserting here fires on_auth_user_created, which creates public.profiles.
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-a000-000000000001',
    'authenticated', 'authenticated',
    'demo@local.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', 'Arben Hoxha',
      'role', 'agent',
      'agency_name', 'Tirana Home Real Estate',
      'preferred_language', 'sq',
      'avatar_url', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
    ),
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-a000-000000000002',
    'authenticated', 'authenticated',
    'agent@local.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', 'Elira Kola',
      'role', 'agent',
      'agency_name', 'Adriatik Properties',
      'preferred_language', 'sq',
      'avatar_url', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
    ),
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-a000-000000000003',
    'authenticated', 'authenticated',
    'buyer@local.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', 'Sokol Meta',
      'role', 'buyer',
      'preferred_language', 'sq',
      'avatar_url', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80'
    ),
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. AUTH IDENTITIES
--    GoTrue resolves an email/password login through auth.identities; without a
--    provider='email' row, signInWithPassword returns "Invalid login credentials"
--    even though the auth.users row exists.
--    NOT EXISTS rather than ON CONFLICT: the unique constraint name/shape on this
--    table has changed between GoTrue versions, this guard has not.
--    auth.identities.email is a GENERATED column — never insert into it.
-- -----------------------------------------------------------------------------
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  now(), now(), now()
from auth.users u
where u.id in (
  'd0000000-0000-4000-a000-000000000001',
  'd0000000-0000-4000-a000-000000000002',
  'd0000000-0000-4000-a000-000000000003'
)
and not exists (
  select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
);

-- -----------------------------------------------------------------------------
-- 3. PROFILES
--    handle_new_user() already inserted id/full_name/avatar_url/role/agency_name/
--    preferred_language. This UPSERT adds phone and bio, which no client-reachable
--    path can write (authenticated may UPDATE only full_name, agency_name,
--    preferred_language) — and phone is exactly what the public agent page and the
--    call/WhatsApp buttons read. DO UPDATE, not a plain INSERT: the trigger has
--    already claimed the primary key.
-- -----------------------------------------------------------------------------
insert into public.profiles (id, full_name, avatar_url, phone, role, agency_name, bio, preferred_language)
values
  (
    'd0000000-0000-4000-a000-000000000001',
    'Arben Hoxha',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    '+355 69 200 1001',
    'agent',
    'Tirana Home Real Estate',
    'Agjent imobiliar në Tiranë prej 12 vitesh. I specializuar në apartamente dhe zyra në zonën qendrore.',
    'sq'
  ),
  (
    'd0000000-0000-4000-a000-000000000002',
    'Elira Kola',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    '+355 69 200 2002',
    'agent',
    'Adriatik Properties',
    'Vila, shtëpi private dhe troje në periferi të Tiranës. Konsulencë falas për blerësit e parë.',
    'sq'
  ),
  (
    'd0000000-0000-4000-a000-000000000003',
    'Sokol Meta',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    '+355 68 300 3003',
    'buyer',
    null,
    null,
    'sq'
  )
on conflict (id) do update set
  full_name          = excluded.full_name,
  avatar_url         = excluded.avatar_url,
  phone              = excluded.phone,
  role               = excluded.role,
  agency_name        = excluded.agency_name,
  bio                = excluded.bio,
  preferred_language = excluded.preferred_language;

-- -----------------------------------------------------------------------------
-- 4. PROPERTIES — 12 active listings in Tiranë
--    7 owned by demo@local.test, 5 by agent@local.test.
--    Prices in EUR: sale = total price, rent = per month, daily_rent = per night.
-- -----------------------------------------------------------------------------
insert into public.properties (
  id, agent_id, owner_id, owner_type,
  title, title_i18n, description, description_i18n,
  source_language, translation_meta,
  price, currency, address, city,
  sqft, beds, baths,
  property_type, listing_type, status,
  floor, total_floors, year_built,
  latitude, longitude,
  features, image_urls,
  whatsapp_enabled, contact_email, contact_phone,
  created_at
)
values
  (
    'b0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Apartament 2+1 në Bllok, i mobiluar',
    '{"sq":"Apartament 2+1 në Bllok, i mobiluar","en":"Furnished 2+1 apartment in Blloku"}'::jsonb,
    'Apartament 2+1 plotësisht i mobiluar në zemër të Bllokut, kat i 5-të me ashensor.
Ballkon i gjerë me pamje nga bulevardi, dritare të dyfishta dhe kondicionerë në çdo dhomë.
Pranë kafeneve, supermarketeve dhe stacionit të autobusit.',
    '{"sq":"Apartament 2+1 plotësisht i mobiluar në zemër të Bllokut, kat i 5-të me ashensor.\nBallkon i gjerë me pamje nga bulevardi, dritare të dyfishta dhe kondicionerë në çdo dhomë.\nPranë kafeneve, supermarketeve dhe stacionit të autobusit.","en":"Fully furnished 2+1 apartment in the heart of Blloku, 5th floor with elevator.\nWide balcony overlooking the boulevard, double-glazed windows and air conditioning in every room.\nSteps away from cafes, supermarkets and the bus stop."}'::jsonb,
    'sq', '{"en":{"sourceHash":"1hm47jhih5g","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    195000, 'EUR', 'Rruga Ismail Qemali 12, Blloku', 'Tiranë',
    92, 2, 1.5,
    'apartment', 'sale', 'active',
    5, 9, 2016,
    41.3181, 19.8187,
    array['balcony', 'elevator', 'furnished', 'airConditioning', 'heating', 'parking'],
    array['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '1 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Garsoniere 1+1 me qira, Komuna e Parisit',
    '{"sq":"Garsoniere 1+1 me qira, Komuna e Parisit","en":"1+1 studio for rent, Komuna e Parisit"}'::jsonb,
    'Garsoniere 1+1 e rinovuar plotësisht, ideale për një person ose çift.
Kuzhinë e pajisur, lavatriçe dhe ngrohje qendrore. Qiraja nuk përfshin faturat.
Kontrata minimale 12 muaj, garanci një muaj.',
    '{"sq":"Garsoniere 1+1 e rinovuar plotësisht, ideale për një person ose çift.\nKuzhinë e pajisur, lavatriçe dhe ngrohje qendrore. Qiraja nuk përfshin faturat.\nKontrata minimale 12 muaj, garanci një muaj.","en":"Fully renovated 1+1 studio, ideal for a single person or a couple.\nEquipped kitchen, washing machine and central heating. Rent does not include utilities.\nMinimum 12-month contract, one month deposit."}'::jsonb,
    'sq', '{"en":{"sourceHash":"lej6yek8m6","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    550, 'EUR', 'Rruga e Kosovarëve 44, Komuna e Parisit', 'Tiranë',
    62, 1, 1,
    'apartment', 'rent', 'active',
    3, 7, 2012,
    41.3128, 19.8062,
    array['elevator', 'furnished', 'heating', 'airConditioning'],
    array['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '3 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002', 'agent',
    'Vilë 5 dhoma me kopsht dhe pishinë, Lundër',
    '{"sq":"Vilë 5 dhoma me kopsht dhe pishinë, Lundër","en":"5-bedroom villa with garden and pool, Lundër"}'::jsonb,
    'Vilë tre katëshe në një nga zonat më të qeta të Lundrës, me kopsht 450 m² dhe pishinë private.
Garazh për dy makina, sistem alarmi dhe ngrohje me pompë nxehtësie.
Dokumentacion i pastër, hipotekë e gatshme.',
    '{"sq":"Vilë tre katëshe në një nga zonat më të qeta të Lundrës, me kopsht 450 m² dhe pishinë private.\nGarazh për dy makina, sistem alarmi dhe ngrohje me pompë nxehtësie.\nDokumentacion i pastër, hipotekë e gatshme.","en":"Three-storey villa in one of the quietest parts of Lundër, with a 450 sqm garden and a private pool.\nTwo-car garage, alarm system and heat-pump heating.\nClean paperwork, mortgage-ready."}'::jsonb,
    'sq', '{"en":{"sourceHash":"jxraiwvga3","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    480000, 'EUR', 'Rruga e Lundrës, Lundër', 'Tiranë',
    320, 5, 3.5,
    'villa', 'sale', 'active',
    null, 3, 2019,
    41.2861, 19.8642,
    array['garden', 'pool', 'parking', 'security', 'heating', 'airConditioning', 'storage'],
    array['https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'],
    true, 'agent@local.test', '+355 69 200 2002',
    now() - interval '5 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000004', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Apartament 3+1, Myslym Shyri',
    '{"sq":"Apartament 3+1, Myslym Shyri","en":"3+1 apartment, Myslym Shyri"}'::jsonb,
    'Apartament i gjerë 3+1 në një pallat të vitit 2008, kat i 4-t me ashensor.
Dy ballkone, dyshemetë prej parketi dhe dritare alumini me xham të dyfishtë.
Parkim i siguruar në bodrum, i përfshirë në çmim.',
    '{"sq":"Apartament i gjerë 3+1 në një pallat të vitit 2008, kat i 4-t me ashensor.\nDy ballkone, dyshemetë prej parketi dhe dritare alumini me xham të dyfishtë.\nParkim i siguruar në bodrum, i përfshirë në çmim.","en":"Spacious 3+1 apartment in a 2008 building, 4th floor with elevator.\nTwo balconies, parquet floors and double-glazed aluminium windows.\nSecure basement parking included in the price."}'::jsonb,
    'sq', '{"en":{"sourceHash":"1hgyzur5l7m","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    245000, 'EUR', 'Rruga Myslym Shyri 78', 'Tiranë',
    128, 3, 2,
    'apartment', 'sale', 'active',
    4, 8, 2008,
    41.3253, 19.8134,
    array['balcony', 'elevator', 'parking', 'heating', 'storage'],
    array['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '7 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Studio me qira ditore në Bllok',
    '{"sq":"Studio me qira ditore në Bllok","en":"Daily rental studio in Blloku"}'::jsonb,
    'Studio moderne për qira ditore, e pajisur me gjithçka: WiFi fiber, Smart TV, kuzhinë e plotë.
Çarçafë dhe peshqirë të përfshirë, pastrim pas çdo qëndrimi.
Check-in vetëqasës me kod, minimum 2 net.',
    '{"sq":"Studio moderne për qira ditore, e pajisur me gjithçka: WiFi fiber, Smart TV, kuzhinë e plotë.\nÇarçafë dhe peshqirë të përfshirë, pastrim pas çdo qëndrimi.\nCheck-in vetëqasës me kod, minimum 2 net.","en":"Modern studio for daily rental, fully equipped: fibre WiFi, smart TV, full kitchen.\nLinen and towels included, cleaning after every stay.\nSelf check-in with a code, 2-night minimum."}'::jsonb,
    'sq', '{"en":{"sourceHash":"wybiuc56sp","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    65, 'EUR', 'Rruga Pjetër Bogdani 5, Blloku', 'Tiranë',
    45, 1, 1,
    'apartment', 'daily_rent', 'active',
    2, 6, 2018,
    41.3169, 19.8203,
    array['furnished', 'airConditioning', 'elevator', 'heating'],
    array['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '9 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002', 'agent',
    'Shtëpi private 4 dhoma me oborr, Farkë',
    '{"sq":"Shtëpi private 4 dhoma me oborr, Farkë","en":"4-bedroom detached house with yard, Farkë"}'::jsonb,
    'Shtëpi private dykatëshe me oborr 200 m², e ndërtuar në 2014 dhe e mirëmbajtur shumë mirë.
Kuzhinë e madhe me dalje në verandë, papafingo e shfrytëzueshme për depo.
Ujë 24 orë nga pusi privat, panele diellore për ujin e ngrohtë.',
    '{"sq":"Shtëpi private dykatëshe me oborr 200 m², e ndërtuar në 2014 dhe e mirëmbajtur shumë mirë.\nKuzhinë e madhe me dalje në verandë, papafingo e shfrytëzueshme për depo.\nUjë 24 orë nga pusi privat, panele diellore për ujin e ngrohtë.","en":"Two-storey detached house with a 200 sqm yard, built in 2014 and very well maintained.\nLarge kitchen opening onto the veranda, usable attic for storage.\n24-hour water from a private well, solar panels for hot water."}'::jsonb,
    'sq', '{"en":{"sourceHash":"1rfok0fnh4w","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    310000, 'EUR', 'Rruga e Farkës 21, Farkë', 'Tiranë',
    210, 4, 2.5,
    'house', 'sale', 'active',
    null, 2, 2014,
    41.2985, 19.8544,
    array['garden', 'parking', 'storage', 'heating', 'security'],
    array['https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'],
    true, 'agent@local.test', '+355 69 200 2002',
    now() - interval '11 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000007', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Zyrë 140 m² me qira, Tirana e Re',
    '{"sq":"Zyrë 140 m² me qira, Tirana e Re","en":"140 sqm office for rent, Tirana e Re"}'::jsonb,
    'Ambient zyre në katin e 7-të të një kulle biznesi, i ndarë në 4 zyra plus salla mbledhjesh.
Recepsion, dy tualete dhe kuzhinë e vogël. Ashensor dhe siguri 24/7.
Çmimi është pa TVSH, parkimi negociohet veçmas.',
    '{"sq":"Ambient zyre në katin e 7-të të një kulle biznesi, i ndarë në 4 zyra plus salla mbledhjesh.\nRecepsion, dy tualete dhe kuzhinë e vogël. Ashensor dhe siguri 24/7.\nÇmimi është pa TVSH, parkimi negociohet veçmas.","en":"Office space on the 7th floor of a business tower, split into 4 offices plus a meeting room.\nReception, two toilets and a kitchenette. Elevator and 24/7 security.\nPrice excludes VAT, parking negotiated separately."}'::jsonb,
    'sq', '{"en":{"sourceHash":"z1ggnibzgl","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    1400, 'EUR', 'Rruga e Kavajës 132, Tirana e Re', 'Tiranë',
    140, null, 2,
    'office', 'rent', 'active',
    7, 12, 2017,
    41.3195, 19.8095,
    array['elevator', 'airConditioning', 'security', 'parking', 'heating'],
    array['https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '13 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000008', 'd0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002', 'agent',
    'Apartament 2+1 me qira, Don Bosko',
    '{"sq":"Apartament 2+1 me qira, Don Bosko","en":"2+1 apartment for rent, Don Bosko"}'::jsonb,
    'Apartament 2+1 i mobiluar pjesërisht, kat i 6-të me ashensor dhe pamje të hapur.
Ngrohje qendrore e pallatit, kondicionerë në sallon dhe në dhomën kryesore.
Pranë shkollës dhe qendrës tregtare, autobusi 200 metra larg.',
    '{"sq":"Apartament 2+1 i mobiluar pjesërisht, kat i 6-të me ashensor dhe pamje të hapur.\nNgrohje qendrore e pallatit, kondicionerë në sallon dhe në dhomën kryesore.\nPranë shkollës dhe qendrës tregtare, autobusi 200 metra larg.","en":"Partly furnished 2+1 apartment, 6th floor with elevator and open views.\nBuilding-wide central heating, air conditioning in the living room and master bedroom.\nNext to the school and shopping centre, bus stop 200 metres away."}'::jsonb,
    'sq', '{"en":{"sourceHash":"1incy04yzq0","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    700, 'EUR', 'Rruga Dritan Hoxha 60, Don Bosko', 'Tiranë',
    85, 2, 1,
    'apartment', 'rent', 'active',
    6, 10, 2011,
    41.3362, 19.8047,
    array['balcony', 'elevator', 'heating', 'airConditioning', 'furnished'],
    array['https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1200&q=80'],
    true, 'agent@local.test', '+355 69 200 2002',
    now() - interval '15 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000009', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Truall 800 m² për ndërtim, Sauk',
    '{"sq":"Truall 800 m² për ndërtim, Sauk","en":"800 sqm building plot, Sauk"}'::jsonb,
    'Truall 800 m² me front rruge 20 metra, i sheshtë dhe me akses të asfaltuar.
Ujë, energji elektrike dhe kanalizim në kufi të pronës.
Leje zhvillimore për deri në tre kate sipas planit të zonës. Certifikatë pronësie e pastër.',
    '{"sq":"Truall 800 m² me front rruge 20 metra, i sheshtë dhe me akses të asfaltuar.\nUjë, energji elektrike dhe kanalizim në kufi të pronës.\nLeje zhvillimore për deri në tre kate sipas planit të zonës. Certifikatë pronësie e pastër.","en":"800 sqm plot with a 20-metre road frontage, flat and with paved access.\nWater, electricity and sewerage at the property boundary.\nDevelopment permit for up to three storeys under the area plan. Clean title deed."}'::jsonb,
    'sq', '{"en":{"sourceHash":"41h7tztyuc","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    120000, 'EUR', 'Rruga e Saukut, Sauk i Vjetër', 'Tiranë',
    800, null, null,
    'land', 'sale', 'active',
    null, null, null,
    41.2932, 19.8358,
    '{}'::text[],
    array['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '17 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000010', 'd0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002', 'agent',
    'Njësi tregtare 95 m² në rrugë kryesore',
    '{"sq":"Njësi tregtare 95 m² në rrugë kryesore","en":"95 sqm retail unit on a main road"}'::jsonb,
    'Njësi tregtare në kat përdhes me vitrinë 8 metra në një nga rrugët më të frekuentuara të Tiranës.
Ambient i hapur, magazinë e vogël dhe tualet. Aktualisht e lirë, dorëzohet menjëherë.
E përshtatshme për kafe, market ose sallon.',
    '{"sq":"Njësi tregtare në kat përdhes me vitrinë 8 metra në një nga rrugët më të frekuentuara të Tiranës.\nAmbient i hapur, magazinë e vogël dhe tualet. Aktualisht e lirë, dorëzohet menjëherë.\nE përshtatshme për kafe, market ose sallon.","en":"Ground-floor retail unit with an 8-metre shopfront on one of Tirana''s busiest streets.\nOpen-plan space, small stockroom and a toilet. Currently vacant, available immediately.\nSuitable for a cafe, mini-market or salon."}'::jsonb,
    'sq', '{"en":{"sourceHash":"zxw64ihunf","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    180000, 'EUR', 'Rruga e Kavajës 210', 'Tiranë',
    95, null, 1,
    'commercial', 'sale', 'active',
    0, 8, 2009,
    41.3232, 19.7999,
    array['storage', 'airConditioning', 'security'],
    array['https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80'],
    true, 'agent@local.test', '+355 69 200 2002',
    now() - interval '19 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000011', 'd0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'agent',
    'Garazh i mbyllur 18 m², 21 Dhjetori',
    '{"sq":"Garazh i mbyllur 18 m², 21 Dhjetori","en":"Closed 18 sqm garage, 21 Dhjetori"}'::jsonb,
    'Garazh i mbyllur në bodrumin e një pallati të ri, me derë automatike dhe kamera sigurie.
Akses 24 orë me telekomandë. Përshtatet edhe si depo.
Pagesa e mirëmbajtjes 10 euro në muaj.',
    '{"sq":"Garazh i mbyllur në bodrumin e një pallati të ri, me derë automatike dhe kamera sigurie.\nAkses 24 orë me telekomandë. Përshtatet edhe si depo.\nPagesa e mirëmbajtjes 10 euro në muaj.","en":"Closed garage in the basement of a new building, with an automatic door and security cameras.\n24-hour access by remote control. Also usable as storage.\nMaintenance fee of 10 euro per month."}'::jsonb,
    'sq', '{"en":{"sourceHash":"254yqgad40q","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    14500, 'EUR', 'Rruga Llazi Miho 3, 21 Dhjetori', 'Tiranë',
    18, null, null,
    'garage', 'sale', 'active',
    -1, 9, 2021,
    41.3268, 19.7988,
    array['security', 'storage', 'parking'],
    array['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80'],
    true, 'demo@local.test', '+355 69 200 1001',
    now() - interval '21 days'
  ),
  (
    'b0000000-0000-4000-a000-000000000012', 'd0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002', 'agent',
    'Apartament 2+1 pranë Liqenit të Thatë',
    '{"sq":"Apartament 2+1 pranë Liqenit të Thatë","en":"2+1 apartment near Liqeni i Thatë"}'::jsonb,
    'Apartament 2+1 në kat të dytë, i mirëmbajtur dhe gati për t''u banuar.
Afër parkut të Liqenit Artificial, në një zonë të qetë familjare.
Pallati ka ashensor dhe hyrje me interfon. Investim i mirë edhe për qira.',
    '{"sq":"Apartament 2+1 në kat të dytë, i mirëmbajtur dhe gati për t''u banuar.\nAfër parkut të Liqenit Artificial, në një zonë të qetë familjare.\nPallati ka ashensor dhe hyrje me interfon. Investim i mirë edhe për qira.","en":"2+1 apartment on the second floor, well maintained and move-in ready.\nClose to the Artificial Lake park, in a quiet family neighbourhood.\nThe building has an elevator and intercom entry. A solid buy-to-let investment too."}'::jsonb,
    'sq', '{"en":{"sourceHash":"171cceqwle8","manual":false,"updatedAt":"2026-09-01T09:00:00.000Z"}}'::jsonb,
    135000, 'EUR', 'Rruga Kavaja 15, Liqeni i Thatë', 'Tiranë',
    78, 2, 1,
    'apartment', 'sale', 'active',
    2, 6, 2006,
    41.3055, 19.8285,
    array['balcony', 'elevator', 'heating'],
    array['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'],
    true, 'agent@local.test', '+355 69 200 2002',
    now() - interval '23 days'
  )
on conflict (id) do update set
  agent_id         = excluded.agent_id,
  owner_id         = excluded.owner_id,
  owner_type       = excluded.owner_type,
  title            = excluded.title,
  title_i18n       = excluded.title_i18n,
  description      = excluded.description,
  description_i18n = excluded.description_i18n,
  source_language  = excluded.source_language,
  translation_meta = excluded.translation_meta,
  price            = excluded.price,
  currency         = excluded.currency,
  address          = excluded.address,
  city             = excluded.city,
  sqft             = excluded.sqft,
  beds             = excluded.beds,
  baths            = excluded.baths,
  property_type    = excluded.property_type,
  listing_type     = excluded.listing_type,
  status           = excluded.status,
  floor            = excluded.floor,
  total_floors     = excluded.total_floors,
  year_built       = excluded.year_built,
  latitude         = excluded.latitude,
  longitude        = excluded.longitude,
  features         = excluded.features,
  image_urls       = excluded.image_urls,
  whatsapp_enabled = excluded.whatsapp_enabled,
  contact_email    = excluded.contact_email,
  contact_phone    = excluded.contact_phone;

-- -----------------------------------------------------------------------------
-- 5. FAVORITES
--    favorites.user_id -> public.profiles(id) (NOT auth.users). Unique on
--    (user_id, property_id), which is the conflict target.
-- -----------------------------------------------------------------------------
insert into public.favorites (user_id, property_id)
values
  ('d0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000001'),
  ('d0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000003'),
  ('d0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000005'),
  ('d0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000006'),
  ('d0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000012')
on conflict (user_id, property_id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. PROPERTY ACTIVITY
--    type is CHECK-constrained to ('call','message','meeting','view','favourite')
--    — note the BRITISH spelling of 'favourite', even though the favorites TABLE
--    is spelled American. user_id -> auth.users(id), not profiles.
--    Only the listing's owner/agent can read these rows.
-- -----------------------------------------------------------------------------
insert into public.property_activity (id, property_id, user_id, type, metadata, created_at)
values
  ('ac000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000003', 'view',      '{"source":"home"}'::jsonb,            now() - interval '6 hours'),
  ('ac000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000003', 'favourite', '{}'::jsonb,                            now() - interval '5 hours'),
  ('ac000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000003', 'call',      '{"channel":"phone"}'::jsonb,           now() - interval '4 hours'),
  ('ac000000-0000-4000-a000-000000000004', 'b0000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000003', 'view',      '{"source":"map"}'::jsonb,              now() - interval '2 days'),
  ('ac000000-0000-4000-a000-000000000005', 'b0000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000003', 'message',   '{"channel":"whatsapp"}'::jsonb,        now() - interval '2 days'),
  ('ac000000-0000-4000-a000-000000000006', 'b0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000003', 'view',      '{"source":"explore"}'::jsonb,          now() - interval '3 days'),
  ('ac000000-0000-4000-a000-000000000007', 'b0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000003', 'meeting',   '{"note":"vizitë të shtunën 11:00"}'::jsonb, now() - interval '1 day'),
  ('ac000000-0000-4000-a000-000000000008', 'b0000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000001', 'view',      '{"source":"explore"}'::jsonb,          now() - interval '8 days'),
  ('ac000000-0000-4000-a000-000000000009', 'b0000000-0000-4000-a000-000000000012', 'd0000000-0000-4000-a000-000000000001', 'favourite', '{}'::jsonb,                            now() - interval '9 days'),
  ('ac000000-0000-4000-a000-000000000010', 'b0000000-0000-4000-a000-000000000007', 'd0000000-0000-4000-a000-000000000003', 'view',      '{"source":"search"}'::jsonb,           now() - interval '12 hours')
on conflict (id) do nothing;

commit;

-- -----------------------------------------------------------------------------
-- Sanity check (optional):
--   select status, count(*) from public.properties group by 1;
--   select email from auth.users order by email;
--   set role anon; select count(*) from public.properties; reset role;
-- The last one must return 12 — if it returns 0 or "permission denied for table
-- properties", see the auto_expose_new_tables note in supabase/config.toml:
--   its implicit default flipped to false on 2026-05-30, which strips the
--   anon/authenticated grants every table here relies on.
-- -----------------------------------------------------------------------------

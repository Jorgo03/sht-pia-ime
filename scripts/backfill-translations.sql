-- Backfill listing translations for the 3 live listings.
--
-- This is exactly what scripts/bulk-translate.js (commit aa26a12, 2 Sep 2026)
-- would have written, done as one transaction so it needs no service-role key:
--   * additive  -- the `||` merge preserves the existing "sq" entry and any
--                  language an agent wrote by hand
--   * provenance -- translation_meta records manual:false plus the sourceHash
--                  that sourceFingerprint(title, description) produces today,
--                  so shouldTranslate() reports CURRENT and will not re-bill,
--                  and the wizard still refreshes it if the Albanian changes
--   * safe to repeat -- re-running overwrites with identical values
--
-- Paste into the Supabase SQL editor (project xzzzhlwmzotibrxdqmcm) and Run.

begin;

-- 1/3  Apartament 1+1 me qera Ali Demi        fingerprint 14l9igam5r4
update properties set
  title_i18n = coalesce(title_i18n,'{}'::jsonb) || $t${
    "en":"1+1 Apartment for rent, Ali Demi",
    "de":"1+1 Wohnung zu vermieten, Ali Demi",
    "it":"Appartamento 1+1 in affitto, Ali Demi",
    "es":"Apartamento 1+1 en alquiler, Ali Demi",
    "pl":"Mieszkanie 1+1 do wynajęcia, Ali Demi",
    "ru":"Квартира 1+1 в аренду, Ali Demi",
    "fr":"Appartement 1+1 à louer, Ali Demi"}$t$::jsonb,
  description_i18n = coalesce(description_i18n,'{}'::jsonb) || $d${
    "en":"Selling a 1+1 apartment at Ali Demi\nnew building with elevator.\nfurnished",
    "de":"Verkaufe eine 1+1 Wohnung in Ali Demi\nNeubau mit Aufzug.\nmöbliert",
    "it":"Vendo appartamento 1+1 ad Ali Demi\npalazzo nuovo con ascensore.\narredato",
    "es":"Vendo apartamento 1+1 en Ali Demi\nedificio nuevo con ascensor.\namueblado",
    "pl":"Sprzedam mieszkanie 1+1 przy Ali Demi\nnowy budynek z windą.\numeblowane",
    "ru":"Продаю квартиру 1+1 в районе Ali Demi\nновый дом с лифтом.\nс мебелью",
    "fr":"Vends appartement 1+1 à Ali Demi\nimmeuble neuf avec ascenseur.\nmeublé"}$d$::jsonb,
  translation_meta = coalesce(translation_meta,'{}'::jsonb) || (
    select jsonb_object_agg(l, jsonb_build_object(
      'sourceHash','14l9igam5r4','manual',false,
      'updatedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    from unnest(array['en','de','it','es','pl','ru','fr']) l)
where id = '83afd071-1db3-4ac5-9cba-a4c0990c5376';

-- 2/3  Apartament 2+1+2 në Durres             fingerprint 23t9q5lxaa8
update properties set
  title_i18n = coalesce(title_i18n,'{}'::jsonb) || $t${
    "en":"2+1+2 Apartment in Durres",
    "de":"2+1+2 Wohnung in Durres",
    "it":"Appartamento 2+1+2 a Durres",
    "es":"Apartamento 2+1+2 en Durres",
    "pl":"Mieszkanie 2+1+2 w Durres",
    "ru":"Квартира 2+1+2 в Durres",
    "fr":"Appartement 2+1+2 à Durres"}$t$::jsonb,
  description_i18n = coalesce(description_i18n,'{}'::jsonb) || $d${
    "en":"New apartment, Lagjja 12, Durres, 2nd floor, existing building, near the Qemal Mici school, every amenity very close by, no elevator",
    "de":"Neue Wohnung, Lagjja 12, Durres, 2. Stock, Bestandsgebäude, in der Nähe der Schule Qemal Mici, alle Einrichtungen ganz in der Nähe, kein Aufzug",
    "it":"Appartamento nuovo, Lagjja 12, Durres, 2° piano, palazzo esistente, vicino alla scuola Qemal Mici, ogni servizio molto vicino, senza ascensore",
    "es":"Apartamento nuevo, Lagjja 12, Durres, 2ª planta, edificio existente, cerca de la escuela Qemal Mici, todos los servicios muy cerca, sin ascensor",
    "pl":"Nowe mieszkanie, Lagjja 12, Durres, 2. piętro, istniejący budynek, blisko szkoły Qemal Mici, wszystkie udogodnienia bardzo blisko, bez windy",
    "ru":"Новая квартира, Lagjja 12, Durres, 2-й этаж, существующее здание, рядом со школой Qemal Mici, вся инфраструктура совсем рядом, без лифта",
    "fr":"Appartement neuf, Lagjja 12, Durres, 2e étage, immeuble existant, près de l'école Qemal Mici, tous les services très proches, sans ascenseur"}$d$::jsonb,
  translation_meta = coalesce(translation_meta,'{}'::jsonb) || (
    select jsonb_object_agg(l, jsonb_build_object(
      'sourceHash','23t9q5lxaa8','manual',false,
      'updatedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    from unnest(array['en','de','it','es','pl','ru','fr']) l)
where id = 'be075ada-088a-4e01-abfe-e75516fa2075';

-- 3/3  Aparrtament modern 2+1 Pazar i Ri      fingerprint 15jhms1nbcv
update properties set
  title_i18n = coalesce(title_i18n,'{}'::jsonb) || $t${
    "en":"Modern 2+1 Apartment, Pazar i Ri",
    "de":"Moderne 2+1 Wohnung, Pazar i Ri",
    "it":"Appartamento moderno 2+1, Pazar i Ri",
    "es":"Apartamento moderno 2+1, Pazar i Ri",
    "pl":"Nowoczesne mieszkanie 2+1, Pazar i Ri",
    "ru":"Современная квартира 2+1, Pazar i Ri",
    "fr":"Appartement moderne 2+1, Pazar i Ri"}$t$::jsonb,
  description_i18n = coalesce(description_i18n,'{}'::jsonb) || $d${
    "en":"2+1 apartment, 128 m2 area, Pazar i Ri, well furnished. 7th floor with elevator, new building",
    "de":"Wohnung 2+1, 128 m2 Fläche, Pazar i Ri, gut möbliert. 7. Stock mit Aufzug, Neubau",
    "it":"Appartamento 2+1, superficie 128 m2, Pazar i Ri, ben arredato. 7° piano con ascensore, palazzo nuovo",
    "es":"Apartamento 2+1, superficie 128 m2, Pazar i Ri, bien amueblado. 7ª planta con ascensor, edificio nuevo",
    "pl":"Mieszkanie 2+1, powierzchnia 128 m2, Pazar i Ri, dobrze umeblowane. 7. piętro z windą, nowy budynek",
    "ru":"Квартира 2+1, площадь 128 m2, Pazar i Ri, хорошо меблирована. 7-й этаж с лифтом, новый дом",
    "fr":"Appartement 2+1, surface 128 m2, Pazar i Ri, bien meublé. 7e étage avec ascenseur, immeuble neuf"}$d$::jsonb,
  translation_meta = coalesce(translation_meta,'{}'::jsonb) || (
    select jsonb_object_agg(l, jsonb_build_object(
      'sourceHash','15jhms1nbcv','manual',false,
      'updatedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    from unnest(array['en','de','it','es','pl','ru','fr']) l)
where id = '291dcbbf-847e-4721-91a0-616ed77bd3c6';

commit;

-- Verify: every row should read 8 / 8 / 7.
select id,
  (select count(*) from jsonb_object_keys(title_i18n) k)       as title_langs,
  (select count(*) from jsonb_object_keys(description_i18n) k) as desc_langs,
  (select count(*) from jsonb_object_keys(translation_meta) k) as meta_langs
from properties order by created_at desc;

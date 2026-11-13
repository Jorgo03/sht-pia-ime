import { supabase } from '@/lib/supabase';
import {
  HIGHLIGHT_CITIES,
  joinAgents,
  rankCityTiles,
  tallyAgents,
  type AgentEntry,
  type CityTile,
} from '@/src/features/properties/lib/discovery';
import { applyPriceRange } from '@/src/features/properties/lib/priceRange';
import { applyFreeText, applyZoneAndRef } from '@/src/features/properties/lib/searchFilters';
import { propertyOrNotFound } from '@/src/features/properties/lib/propertyResult';

import { Property, PropertyFilters, PropertySort } from './types';

export const PAGE_SIZE = 24;

/** Upper bound on markers fetched for the map — panning must never trigger an
 *  unbounded fetch, and more pins than this is unreadable anyway. */
export const MAP_MARKER_LIMIT = 200;

/**
 * Every card/marker rendering (grid, compact, featured, map bubble, map
 * preview) reads only these columns. `select('*')` here would also pull
 * `description`, `description_i18n`, `features`, `floor_plan`, `video_url`,
 * contact fields, etc. — none of them rendered in a list/map context, all of
 * them dead weight on every page of results and every map pan. Detail views
 * (getPropertyById) still fetch everything, since they render everything.
 */
const LIST_COLUMNS =
  'id, agent_id, owner_id, title, title_i18n, price, currency, address, city, sqft, beds, baths, property_type, listing_type, image_urls, status, latitude, longitude, created_at';

const SORTS: Record<PropertySort, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
};

/**
 * The single place where filters become query predicates, so the list query,
 * the map query and the count query can never disagree about what "matching"
 * means.
 *
 * Typed loosely because supabase-js builder generics change shape with every
 * chained call; the surrounding functions keep the public API typed.
 */
function applyFilters(query: any, f: PropertyFilters): any {
  let q = query;
  if (f.propertyType) q = q.eq('property_type', f.propertyType);
  if (f.listingType) q = q.eq('listing_type', f.listingType);
  // Free text searches city, zone and address — a partial road name
  // ("Kavaj") must find listings even though it is not a city name.
  q = applyFreeText(q, f.city);
  // The sheet's min/max are euros; listings can be priced in ALL or USD too.
  q = applyPriceRange(q, f);
  if (f.beds != null) q = q.gte('beds', f.beds);
  if (f.baths != null) q = q.gte('baths', f.baths);
  // `sqft` holds m², matching the surface labels in the UI.
  if (f.minArea != null) q = q.gte('sqft', f.minArea);
  if (f.maxArea != null) q = q.lte('sqft', f.maxArea);
  if (f.features?.length) q = q.contains('features', f.features);
  // Zone only with its own city; a reference is exact (shared with web).
  q = applyZoneAndRef(q, { city: f.city, zone: f.zone, ref: f.refCode });

  if (f.bounds) {
    // Listings without coordinates can't be placed, so they are excluded here
    // rather than silently rendered at (0, 0) off the coast of Africa.
    q = q
      .not('latitude', 'is', null)
      .gte('latitude', f.bounds.minLat)
      .lte('latitude', f.bounds.maxLat)
      .gte('longitude', f.bounds.minLng)
      .lte('longitude', f.bounds.maxLng);
  }
  return q;
}

function baseQuery(filters: PropertyFilters) {
  const order = SORTS[filters.sort ?? 'newest'];
  return applyFilters(
    supabase
      .from('properties')
      .select(LIST_COLUMNS)
      .eq('status', 'active')
      .order(order.column, { ascending: order.ascending })
      // Ties (same price, same publish time) have no order of their own, so
      // consecutive pages could repeat or skip them; the id settles it.
      .order('id', { ascending: true }),
    filters,
  );
}

/**
 * Paginated listings for the list screen. `offset` appends rather than
 * replaces, so "load more" never refetches what's already on screen.
 */
export async function getProperties(
  filters: PropertyFilters = {},
  { offset = 0, limit = PAGE_SIZE }: { offset?: number; limit?: number } = {},
): Promise<Property[]> {
  const { data, error } = await baseQuery(filters).range(
    offset,
    offset + limit - 1,
  );

  if (error) throw error;
  return data ?? [];
}

/**
 * Exact number of matches, independent of pagination — this is what a
 * "Show N properties" control must report. head:true fetches no rows.
 */
export async function getPropertiesCount(
  filters: PropertyFilters = {},
): Promise<number> {
  const { count, error } = await applyFilters(
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    filters,
  );

  if (error) throw error;
  return count ?? 0;
}

/**
 * One small query per city, through the same filter as Explore, so a tile's
 * count is exactly what tapping it shows. The newest listing lends its photo.
 */
export async function getCityTiles(): Promise<CityTile[]> {
  const tiles = await Promise.all(
    HIGHLIGHT_CITIES.map(async (city) => {
      const { data, count, error } = await applyFilters(
        supabase
          .from('properties')
          .select('image_urls', { count: 'exact' })
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        { city },
      ).limit(1);
      if (error) throw error;
      return { city, count: count ?? 0, photo: (data?.[0]?.image_urls?.[0] as string | undefined) ?? null };
    }),
  );
  return rankCityTiles(tiles);
}

/** Bounds the scan behind the directory, and the profiles asked for after it. */
const AGENT_SCAN_LIMIT = 1000;

/**
 * Agencies and agents with live listings. Built from the listings because
 * `profiles.role` is not readable by signed-out visitors, and because a
 * directory entry with nothing to show is no use to anyone.
 */
export async function getAgentDirectory(): Promise<AgentEntry[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('agent_id')
    .eq('status', 'active')
    .not('agent_id', 'is', null)
    .limit(AGENT_SCAN_LIMIT);
  if (error) throw error;
  const tally = tallyAgents(data);
  if (tally.length === 0) return [];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, agency_name, avatar_url')
    .in('id', tally.map((a) => a.id));
  if (profilesError) throw profilesError;
  return joinAgents(tally, profiles);
}

/** What the comparison shows beyond a card's columns. */
const COMPARE_COLUMNS = `${LIST_COLUMNS}, zone, features, floor, total_floors, year_built`;

export type CompareHome = Property & { floor: number | null; total_floors: number | null };

/** In the order the homes were picked. A listing no longer on sale is absent. */
export async function getCompareProperties(ids: string[]): Promise<CompareHome[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('properties').select(COMPARE_COLUMNS).in('id', ids).eq('status', 'active');
  if (error) throw error;
  const rows = (data ?? []) as unknown as CompareHome[];
  const byId = new Map(rows.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is CompareHome => !!p);
}

/** Listings that can actually be placed on the map, capped at MAP_MARKER_LIMIT. */
export async function getMapProperties(
  filters: PropertyFilters = {},
): Promise<Property[]> {
  const { data, error } = await applyFilters(
    supabase
      .from('properties')
      .select(LIST_COLUMNS)
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    filters,
  ).limit(MAP_MARKER_LIMIT);

  if (error) throw error;
  return data ?? [];
}

export async function getPropertyById(id: string): Promise<Property | null> {
  // Matches the web app's useProperty() query exactly — the embedded select
  // is scoped to the anon SELECT grant on profiles (id, full_name, phone,
  // agency_name, avatar_url), so this works for signed-out visitors too.
  const { data, error } = await supabase
    .from('properties')
    .select('*, agent:profiles(id, full_name, phone, agency_name, avatar_url)')
    .eq('id', id)
    .single();

  // Gone (or not visible) → null; offline or a server error → thrown, so the
  // screen can offer a retry (AUDIT-006).
  return propertyOrNotFound<Property>({ data, error });
}

/**
 * Batch lookup preserving the caller's id order — same contract as web's
 * usePropertiesByIds(), used for the Home screen's "Recently Viewed" rail.
 */
export async function getPropertiesByIds(ids: string[]): Promise<Property[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('properties').select(LIST_COLUMNS).in('id', ids);
  if (error) return [];
  // Supabase's column-string type inference marks every selected column as
  // required (it has no generated Database types to know owner_id is
  // nullable-optional on the real table) — cast rather than fight it, same
  // as the join-shape casts elsewhere in this file/codebase.
  const rows = (data ?? []) as unknown as Property[];
  const byId = new Map(rows.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Property => !!p);
}

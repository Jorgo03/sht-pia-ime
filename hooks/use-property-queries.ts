import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  getMapProperties,
  getProperties,
  getPropertiesByIds,
  getPropertiesCount,
  getPropertyById,
  PAGE_SIZE,
} from '@/data/properties';
import { PropertyFilters } from '@/data/types';

/**
 * One key shape per query family, so Explore/Home/Map/Property-detail never
 * silently reuse each other's cache entries (a fixed 24-item Home page and
 * Explore's infinite-scroll pages fetch the exact same rows under identical
 * filters, but must never share one cache slot — react-query stores them in
 * incompatible shapes). Filters/ids objects are passed as-is: react-query
 * hashes query keys with a stable (sorted-key) JSON serialization, so two
 * different `{}` references still hit the same cache entry.
 */
export const propertyKeys = {
  list: (filters: PropertyFilters, limit: number) => ['properties', 'list', filters, limit] as const,
  infiniteList: (filters: PropertyFilters) => ['properties', 'infinite-list', filters] as const,
  count: (filters: PropertyFilters) => ['properties', 'count', filters] as const,
  map: (filters: PropertyFilters) => ['properties', 'map', filters] as const,
  byIds: (ids: string[]) => ['properties', 'by-ids', ids] as const,
  detail: (id: string) => ['properties', 'detail', id] as const,
};

/** A single fixed-size page — Home's "Matched"/"Featured" source, and
 *  Property Detail's "Similar properties" rail. Not paginated.
 *  `enabled: false` for callers that only know their filters once some other
 *  query has resolved (e.g. "similar to this property" needs the property
 *  loaded first) — skips the fetch entirely rather than querying with
 *  incomplete filters and throwing the result away. */
export function usePropertiesQuery(filters: PropertyFilters, limit: number = PAGE_SIZE, enabled: boolean = true) {
  return useQuery({
    queryKey: propertyKeys.list(filters, limit),
    queryFn: () => getProperties(filters, { limit }),
    enabled,
  });
}

/** Explore's paginated "load more" list. */
export function useInfinitePropertiesQuery(filters: PropertyFilters) {
  return useInfiniteQuery({
    queryKey: propertyKeys.infiniteList(filters),
    queryFn: ({ pageParam }) => getProperties(filters, { offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  });
}

/** Exact result count for a filter set — Explore's header and the filter
 *  sheet's live "Show N homes" CTA both want this independent of pagination,
 *  and (same filters) share one cache entry between the two screens. */
export function usePropertiesCountQuery(filters: PropertyFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: propertyKeys.count(filters),
    queryFn: () => getPropertiesCount(filters),
    enabled,
    // Keeps the previous count on screen while a new filter's count loads,
    // instead of flashing to 0/blank on every keystroke-driven change.
    placeholderData: keepPreviousData,
  });
}

/** Map tab's viewport-bounded marker set. */
export function useMapPropertiesQuery(filters: PropertyFilters) {
  return useQuery({
    queryKey: propertyKeys.map(filters),
    queryFn: () => getMapProperties(filters),
    placeholderData: keepPreviousData,
  });
}

/** Home's "Recently Viewed" rail — batch lookup by id. */
export function usePropertiesByIdsQuery(ids: string[]) {
  return useQuery({
    queryKey: propertyKeys.byIds(ids),
    queryFn: () => getPropertiesByIds(ids),
    enabled: ids.length > 0,
  });
}

/** Property Detail's full record. */
export function usePropertyQuery(id: string | undefined) {
  return useQuery({
    queryKey: propertyKeys.detail(id ?? ''),
    queryFn: () => getPropertyById(id as string),
    enabled: !!id,
  });
}

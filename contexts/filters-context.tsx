import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { PropertyFilters } from '@/data/types';

/** Brief section 4.1 asks for 300-400ms before a filter change hits the API. */
const DEBOUNCE_MS = 350;

const EMPTY: PropertyFilters = { sort: 'newest' };

function isInverted(min?: number | null, max?: number | null): boolean {
  return min != null && max != null && min > max;
}

interface FiltersContextValue {
  /** Immediate state — bind inputs to this so typing feels instant. */
  filters: PropertyFilters;
  /** Debounced and range-corrected — pass this to the data layer. */
  queryFilters: PropertyFilters;
  setFilter: <K extends keyof PropertyFilters>(
    key: K,
    value: PropertyFilters[K],
  ) => void;
  reset: () => void;
  /** Facets currently set, for a badge. Excludes sort, which is always set. */
  activeCount: number;
  priceInvalid: boolean;
  areaInvalid: boolean;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

/**
 * One filter state for the whole app, so the list and map screens read and
 * write the same object instead of keeping separate copies (brief section 6).
 *
 * Map bounds are deliberately NOT held here. The map and list are separate
 * tabs, so a region persisted from the map would silently empty the list when
 * the user switched back to it. The map owns its region locally and passes it
 * to the data layer itself.
 */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<PropertyFilters>(EMPTY);
  const [debounced, setDebounced] = useState<PropertyFilters>(EMPTY);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(filters), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters]);

  const setFilter = useCallback(
    <K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setFilters(EMPTY), []);

  // Reported against the live values so the warning appears while typing.
  const priceInvalid = isInverted(filters.minPrice, filters.maxPrice);
  const areaInvalid = isInverted(filters.minArea, filters.maxArea);

  /**
   * An inverted range is a typo in progress, not a query. Drop the offending
   * pair rather than sending it, so the user sees the previous results plus a
   * warning instead of a misleading empty state.
   */
  const queryFilters = useMemo<PropertyFilters>(() => {
    const badPrice = isInverted(debounced.minPrice, debounced.maxPrice);
    const badArea = isInverted(debounced.minArea, debounced.maxArea);
    return {
      ...debounced,
      minPrice: badPrice ? null : debounced.minPrice,
      maxPrice: badPrice ? null : debounced.maxPrice,
      minArea: badArea ? null : debounced.minArea,
      maxArea: badArea ? null : debounced.maxArea,
    };
  }, [debounced]);

  const activeCount = useMemo(
    () =>
      [
        filters.propertyType,
        filters.listingType,
        filters.city,
        filters.minPrice,
        filters.maxPrice,
        filters.beds,
        filters.baths,
        filters.minArea,
        filters.maxArea,
      ].filter((v) => v != null && v !== '').length,
    [filters],
  );

  const value = useMemo(
    () => ({
      filters,
      queryFilters,
      setFilter,
      reset,
      activeCount,
      priceInvalid,
      areaInvalid,
    }),
    [
      filters,
      queryFilters,
      setFilter,
      reset,
      activeCount,
      priceInvalid,
      areaInvalid,
    ],
  );

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error('useFilters must be used within a FiltersProvider');
  }
  return context;
}

import type { SavedFilters } from './matches';

export declare function savedFromFilters(filters: object | null | undefined): SavedFilters;
export declare function savedKey(saved: object | null | undefined): string;
export declare function hasFacets(saved: object | null | undefined): boolean;
export declare function savedLabel(saved: SavedFilters, t: (key: string) => string): string;

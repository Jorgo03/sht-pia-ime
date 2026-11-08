export interface ComparableHome {
  id: string;
  price: number;
  currency?: string | null;
  sqft: number | null;
  beds: number | null;
  listing_type: string;
  features?: string[] | null;
}

export declare const MAX_COMPARE: number;
export declare function toggleCompareId(ids: string[], id: string, max?: number): string[];
export declare function parseCompareIds(raw: string | null, max?: number): string[];
export declare function pricePerM2(home: ComparableHome): number | null;
export declare function bestOf(homes: ComparableHome[]): {
  price: string | null;
  perM2: string | null;
  area: string | null;
  beds: string | null;
};
export declare function allFeatures(homes: ComparableHome[]): string[];

export interface Property {
  id: string;
  agent_id: string;
  owner_id?: string | null;
  /** Present when fetched via getPropertyById's embedded profiles select. */
  agent?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'agency_name' | 'avatar_url'> | null;
  title: string;
  title_i18n: Record<string, string> | null;
  description: string | null;
  description_i18n: Record<string, string> | null;
  price: number;
  address: string;
  city: string | null;
  /** Stored in the `sqft` column but holds m² — the UI labels it m². */
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  /** Mirrors the property_type check constraint on public.properties. */
  property_type:
    | 'apartment'
    | 'house'
    | 'villa'
    | 'land'
    | 'commercial'
    | 'office'
    | 'garage'
    | null;
  listing_type: 'sale' | 'rent' | 'daily_rent';
  image_urls: string[];
  features?: string[] | null;
  status:
    | 'active'
    | 'pending'
    | 'pending_review'
    | 'sold'
    | 'rented'
    | 'paused'
    | 'draft';
  /** Null until an agent pins the listing on a map — such rows are excluded
   *  from map queries rather than rendered at (0, 0). */
  latitude: number | null;
  longitude: number | null;
  year_built: number | null;
  currency?: string | null;
  /** Listing-level contact overrides — take priority over the agent's own
   *  profile phone/email, same as web's PropertyDetail.jsx `phone` derivation. */
  contact_phone?: string | null;
  contact_email?: string | null;
  /** Language the listing was actually written in; every other key in
   *  title_i18n/description_i18n is a machine translation. */
  source_language: string;
  created_at: string;
  updated_at: string;
}

/** Visible map region, used to re-query listings as the user pans/zooms. */
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type PropertySort = 'newest' | 'price_asc' | 'price_desc';

/**
 * The one filter shape shared by the list and map screens. Every field is
 * optional and null means "unset", so an empty object is a valid unfiltered
 * query.
 */
export interface PropertyFilters {
  propertyType?: Property['property_type'] | null;
  listingType?: Property['listing_type'] | null;
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  beds?: number | null;
  baths?: number | null;
  minArea?: number | null;
  maxArea?: number | null;
  sort?: PropertySort;
  /** Map-only: restricts results to the visible region. */
  bounds?: MapBounds | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: 'buyer' | 'agent';
  agency_name: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

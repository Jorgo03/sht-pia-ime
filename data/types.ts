export interface Property {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  price: number;
  address: string;
  city: string | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  property_type: 'apartment' | 'house' | 'land' | 'commercial' | null;
  listing_type: 'sale' | 'rent';
  image_urls: string[];
  status: 'active' | 'pending' | 'sold' | 'draft';
  created_at: string;
  updated_at: string;
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

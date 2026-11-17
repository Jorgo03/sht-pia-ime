export interface PlaceZone {
  name: string;
  id: string;
  type: 'njesi' | 'lagje' | 'fshat' | 'zone';
  lat: number;
  lng: number;
  keys: string[];
}

export interface PlaceCity {
  city: string;
  label: string;
  bashki: string;
  id: string;
  qark: string;
  names: Partial<Record<'sq' | 'en' | 'it' | 'de' | 'fr' | 'es' | 'pl' | 'ru', string>>;
  lat: number;
  lng: number;
  bbox: [number, number, number, number];
  keys: string[];
  zones: PlaceZone[];
}

export interface PlaceResult {
  city: string;
  zone: string | null;
  label: string;
}

export type PinCheck = 'ok' | 'missing' | 'outside-albania' | 'outside-city';

export function fold(s: unknown): string;
export const ALBANIA_BOX: Readonly<{ minLat: number; maxLat: number; minLng: number; maxLng: number }>;
export function findCity(name: unknown): PlaceCity | null;
export function resolveCity(name: unknown): string | null;
export function cityLabel(city: unknown): string;
export function findZone(city: unknown, zone: unknown): PlaceZone | null;
export function resolveZone(city: unknown, zone: unknown): string | null;
export function locationIdFor(city: unknown, zone?: unknown): string | null;
export function searchPlaces(term: unknown, options?: { limit?: number; city?: string | null }): PlaceResult[];
export function checkPin(city: unknown, lat: unknown, lng: unknown): PinCheck;
export function cityCentre(city: unknown): { latitude: number; longitude: number } | null;

export declare const FIRST_CITIES: readonly string[];
export declare function orderCities(names: string[]): string[];

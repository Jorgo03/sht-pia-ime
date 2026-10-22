import type { TranslationMeta } from '../../../lib/translationCore';

type I18nMap = Record<string, string>;

export interface ListingFormValues {
  listing_type: string;
  property_type: string;
  title_i18n: I18nMap;
  description_i18n: I18nMap;
  translation_meta: TranslationMeta;
  city: string;
  zone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  price: string;
  currency: string;
  sqft: string;
  beds: string;
  baths: string;
  floor: string;
  total_floors: string;
  year_built: string;
  features: string[];
  contact_phone: string;
  whatsapp_enabled: boolean;
  contact_email: string;
}

export interface TranslatedMaps {
  title_i18n: I18nMap;
  description_i18n: I18nMap;
  translation_meta: TranslationMeta;
}

export function propertyToForm(row: Record<string, any>): ListingFormValues;
export function formToColumns(form: ListingFormValues, translated: TranslatedMaps): Record<string, unknown>;
export function closedStatusFor(listingType: string): 'sold' | 'rented';

export function removedMediaPaths(args: {
  before?: (string | null | undefined)[];
  after?: (string | null | undefined)[];
  userId: string | null | undefined;
  bucket?: string;
}): string[];
export function normalizeAmount(text: string | null | undefined): string;

import { PixelRatio } from 'react-native';

// Shared with the website (tests/imageUrl.test.mjs covers it).
import { thumbnailUrl } from '../src/lib/imageUrl.js';

/**
 * On once the Supabase project has image transformations (a paid plan):
 * set EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORMS=1 and rebuild. Off, every photo
 * URL is used as it is.
 */
const TRANSFORMS = process.env.EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORMS === '1';

/** A listing photo sized for a card drawn `width` points wide. */
export function cardImageUrl<T extends string | null | undefined>(url: T, width: number): T {
  return thumbnailUrl(url, width * Math.min(PixelRatio.get(), 3), TRANSFORMS);
}

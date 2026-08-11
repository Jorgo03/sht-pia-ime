import { useWindowDimensions } from 'react-native';

/**
 * A phone in landscape can be WIDER than a small tablet in portrait (e.g. an
 * iPhone 14 Pro Max landscape is ~926px wide), so raw `width` alone can't
 * tell phone-landscape apart from tablet. The SHORT dimension doesn't have
 * that problem — no real phone's short side exceeds ~430px in either
 * orientation, while every tablet's short side is >=600px in both. This
 * matches Android's own "smallest width" tablet qualifier (sw600dp).
 */
const TABLET_MIN_SHORT_DIMENSION = 600;

/**
 * Grid column count by current width. Bumps to 3 at the same 600px threshold
 * that flips isTablet, so a tablet never renders the phone's 2-column grid —
 * that gap (isTablet true at 600 but columns staying at 2 until 768) was the
 * one disclosed inconsistency from the initial pass. 1024 is the brief's own
 * large-tablet/landscape threshold, reused rather than inventing a new one.
 */
function computeColumns(width: number, isLandscape: boolean): number {
  if (width >= 1024) return isLandscape ? 4 : 3;
  if (width >= TABLET_MIN_SHORT_DIMENSION) return 3;
  return 2;
}

export interface Responsive {
  width: number;
  height: number;
  /** Device class, not current width — stable across phone rotation. */
  isTablet: boolean;
  isLandscape: boolean;
  /** Property-card grid columns for the current size. */
  columns: number;
}

/**
 * Single source of truth for size-based layout decisions, backed by RN's
 * built-in useWindowDimensions() — already reactive to rotation/resize, so
 * no manual resize-listener or forceUpdate is needed anywhere that uses this.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= TABLET_MIN_SHORT_DIMENSION;
  const columns = computeColumns(width, isLandscape);

  return { width, height, isTablet, isLandscape, columns };
}

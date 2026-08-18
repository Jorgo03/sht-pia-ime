import { Property } from '@/data/types';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface Cluster {
  /** Stable across renders for a given cell, so markers don't remount on pan. */
  id: string;
  latitude: number;
  longitude: number;
  properties: Property[];
}

/** Cells across the visible region. Higher = looser clustering. */
const GRID_COLUMNS = 6;

/**
 * Grid clustering, deliberately dependency-free.
 *
 * Cell size is derived from the visible region rather than fixed in degrees,
 * so a cell stays roughly the same size on screen at every zoom level: zoom in
 * and clusters break apart naturally, zoom out and they merge. Good enough and
 * O(n) for the MAP_MARKER_LIMIT cap of 200 markers — a quadtree would be
 * premature here.
 */
export function clusterProperties(
  properties: Property[],
  region: MapRegion | null,
): Cluster[] {
  const placeable = properties.filter(
    (p) => p.latitude != null && p.longitude != null,
  );

  // Without a region (first frame) or at a degenerate zoom, show every pin
  // individually rather than collapsing everything into one bogus cluster.
  if (!region || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
    return placeable.map((p) => ({
      id: p.id,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      properties: [p],
    }));
  }

  const cellLat = region.latitudeDelta / GRID_COLUMNS;
  const cellLng = region.longitudeDelta / GRID_COLUMNS;

  const cells = new Map<string, Property[]>();
  for (const p of placeable) {
    const row = Math.floor((p.latitude as number) / cellLat);
    const col = Math.floor((p.longitude as number) / cellLng);
    const key = `${row}:${col}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(p);
    else cells.set(key, [p]);
  }

  return Array.from(cells.entries()).map(([key, group]) => {
    // Anchor a cluster at its members' centroid so the bubble sits over the
    // listings it represents, not at an arbitrary cell corner.
    const latitude =
      group.reduce((sum, p) => sum + (p.latitude as number), 0) / group.length;
    const longitude =
      group.reduce((sum, p) => sum + (p.longitude as number), 0) / group.length;

    return {
      id: group.length === 1 ? group[0].id : `cluster:${key}`,
      latitude,
      longitude,
      properties: group,
    };
  });
}

/** Same per-type palette as web's MapMarker.jsx MARKER_COLORS, so a bubble's
 *  color means the same thing on both apps. */
export const MARKER_COLORS: Record<string, string> = {
  sale: '#FF7A40',
  rent: '#3B82F6',
  daily_rent: '#3B82F6',
  commercial: '#22C55E',
  land: '#EAB308',
};

export function markerColorFor(listingType: string | null | undefined): string {
  return MARKER_COLORS[listingType ?? ''] ?? MARKER_COLORS.sale;
}

/** Compact price for a map bubble: 200000 -> "€200K", 1250000 -> "€1.3M". */
export function formatBubblePrice(price: number): string {
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    // Drop the decimal on round values: 2.0M reads worse than 2M.
    return `€${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
  }
  if (price >= 1_000) return `€${Math.round(price / 1_000)}K`;
  return `€${price}`;
}

// Direct TypeScript port of src/lib/geo.js — same dependency-free
// point-in-polygon/centroid/bounds math, so the RN map's county grouping
// matches the web app's exactly. Keep the two in sync if either changes.

export interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

type Ring = number[][];

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

/** True if [lng, lat] falls inside a Polygon or MultiPolygon geometry. */
export function pointInGeometry(lng: number, lat: number, geometry: GeoJSONGeometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lng, lat, geometry.coordinates as Ring[]);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Ring[][]).some((rings) => pointInPolygon(lng, lat, rings));
  }
  return false;
}

function ringCentroid(ring: Ring): { lng: number; lat: number; area: number } {
  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = xj * yi - xi * yj;
    area += cross;
    cx += (xj + xi) * cross;
    cy += (yj + yi) * cross;
  }
  area /= 2;
  if (area === 0) return { lng: ring[0][0], lat: ring[0][1], area: 0 };
  cx /= 6 * area;
  cy /= 6 * area;
  return { lng: cx, lat: cy, area: Math.abs(area) };
}

/**
 * Centroid of a Polygon/MultiPolygon's largest ring by area, as {lat, lng}
 * (react-native-maps' coordinate shape). For a MultiPolygon this picks the
 * biggest landmass rather than averaging all of them, so a county with a
 * small exclave doesn't get its marker pulled off-center.
 */
export function geometryCentroid(geometry: GeoJSONGeometry): { latitude: number; longitude: number } {
  const polygons: Ring[][] =
    geometry.type === 'MultiPolygon'
      ? (geometry.coordinates as Ring[][])
      : [geometry.coordinates as Ring[]];
  let best: { lng: number; lat: number; area: number } | null = null;
  for (const rings of polygons) {
    const c = ringCentroid(rings[0]);
    if (!best || c.area > best.area) best = c;
  }
  return { latitude: best!.lat, longitude: best!.lng };
}

export interface RegionBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Bounding box for a Polygon/MultiPolygon geometry. */
export function geometryBounds(geometry: GeoJSONGeometry): RegionBounds {
  const polygons: Ring[][] =
    geometry.type === 'MultiPolygon'
      ? (geometry.coordinates as Ring[][])
      : [geometry.coordinates as Ring[]];
  let south = Infinity,
    west = Infinity,
    north = -Infinity,
    east = -Infinity;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lat < south) south = lat;
        if (lat > north) north = lat;
        if (lng < west) west = lng;
        if (lng > east) east = lng;
      }
    }
  }
  return { south, west, north, east };
}

/** Union of several bounds — used once at module load to fit all 12 counties. */
export function unionBounds(boundsList: RegionBounds[]): RegionBounds {
  let south = Infinity,
    west = Infinity,
    north = -Infinity,
    east = -Infinity;
  for (const b of boundsList) {
    if (b.south < south) south = b.south;
    if (b.north > north) north = b.north;
    if (b.west < west) west = b.west;
    if (b.east > east) east = b.east;
  }
  return { south, west, north, east };
}

/** Converts a bounding box into a react-native-maps Region (center + deltas),
 *  with padding so the fitted county isn't flush against the screen edges. */
export function boundsToRegion(bounds: RegionBounds, paddingFactor = 1.3) {
  const latitude = (bounds.north + bounds.south) / 2;
  const longitude = (bounds.east + bounds.west) / 2;
  const latitudeDelta = Math.max((bounds.north - bounds.south) * paddingFactor, 0.02);
  const longitudeDelta = Math.max((bounds.east - bounds.west) * paddingFactor, 0.02);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

// Dependency-free GeoJSON helpers for the county-grouped map view (see
// PropertyMap.jsx). Small enough surface area (point-in-polygon, centroid,
// bounds) that pulling in turf/geojson-utils would be a heavier dependency
// than the code it replaces — same call made for clustering in lib/cluster.ts.

// Ray-casting point-in-polygon for a single GeoJSON polygon ring set:
// rings[0] is the outer boundary, rings[1..] are holes. Coordinates are
// [lng, lat] pairs, per GeoJSON convention.
function pointInRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(lng, lat, rings) {
  if (!pointInRing(lng, lat, rings[0])) return false
  // A point inside any hole is outside the polygon.
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false
  }
  return true
}

/** True if [lng, lat] falls inside a Polygon or MultiPolygon geometry. */
export function pointInGeometry(lng, lat, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lng, lat, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(rings => pointInPolygon(lng, lat, rings))
  }
  return false
}

// Shoelace-formula area + centroid for a single ring, in the same units as
// the input coordinates (degrees) — fine for comparing/centroiding polygons
// that are all part of the same small country, not for real-world area.
function ringCentroid(ring) {
  let area = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const cross = xj * yi - xi * yj
    area += cross
    cx += (xj + xi) * cross
    cy += (yj + yi) * cross
  }
  area /= 2
  if (area === 0) return { lng: ring[0][0], lat: ring[0][1], area: 0 }
  cx /= 6 * area
  cy /= 6 * area
  return { lng: cx, lat: cy, area: Math.abs(area) }
}

/**
 * Centroid of a Polygon/MultiPolygon's largest ring by area, as [lat, lng]
 * (Leaflet's coordinate order). For a MultiPolygon this deliberately picks
 * the biggest landmass rather than averaging all of them, so a county with
 * a small exclave doesn't get its marker pulled off-center.
 */
export function geometryCentroid(geometry) {
  const polygons = geometry.type === 'MultiPolygon'
    ? geometry.coordinates
    : [geometry.coordinates]
  let best = null
  for (const rings of polygons) {
    const c = ringCentroid(rings[0])
    if (!best || c.area > best.area) best = c
  }
  return [best.lat, best.lng]
}

/** [[south, west], [north, east]] bounds for a Polygon/MultiPolygon, for Leaflet's fitBounds. */
export function geometryBounds(geometry) {
  const polygons = geometry.type === 'MultiPolygon'
    ? geometry.coordinates
    : [geometry.coordinates]
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lat < south) south = lat
        if (lat > north) north = lat
        if (lng < west) west = lng
        if (lng > east) east = lng
      }
    }
  }
  return [[south, west], [north, east]]
}

/** Union of several [[south,west],[north,east]] bounds. */
export function unionBounds(boundsList) {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const [[s, w], [n, e]] of boundsList) {
    if (s < south) south = s
    if (n > north) north = n
    if (w < west) west = w
    if (e > east) east = e
  }
  return [[south, west], [north, east]]
}

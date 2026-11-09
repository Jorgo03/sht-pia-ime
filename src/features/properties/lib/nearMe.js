// "Near me" on the map. Pure, for `npm test`. The search itself is the map's
// usual "what is in view": the position never leaves the phone as such.

export const NEAR_ME_RADII = [1, 5, 20]
export const DEFAULT_RADIUS = 5

const KM_PER_DEGREE_LAT = 110.574
const KM_PER_DEGREE_LNG = 111.32

/** The map area that shows `km` around a point in every direction. */
export function regionAround({ latitude, longitude }, km) {
  const cos = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  return {
    latitude,
    longitude,
    latitudeDelta: (2 * km) / KM_PER_DEGREE_LAT,
    longitudeDelta: (2 * km) / (KM_PER_DEGREE_LNG * cos),
  }
}

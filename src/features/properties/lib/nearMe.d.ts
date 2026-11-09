export declare const NEAR_ME_RADII: number[];
export declare const DEFAULT_RADIUS: number;
export declare function regionAround(
  center: { latitude: number; longitude: number },
  km: number,
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

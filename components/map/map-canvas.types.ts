import type { FeatureCollection } from 'geojson';

import type { Property } from '@/data/types';
import type { Cluster } from '@/lib/cluster';
import type { GeoJSONGeometry } from '@/lib/geo';

/** Deliberately NOT `Region` from react-native-maps — that import alone
 *  drags in react-native-maps' native-only internals, which is exactly what
 *  breaks Metro's web bundle. This shape is structurally identical to it. */
export interface MapRegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface CountyGroup {
  id: string;
  name: string;
  geometry: GeoJSONGeometry;
  count: number;
}

export interface MapCanvasProps {
  initialRegion: MapRegionLike;
  onRegionChangeComplete: (region: MapRegionLike) => void;
  onMapPress: () => void;
  isRegionOverview: boolean;
  countyGeojson: FeatureCollection;
  countyGroups: CountyGroup[];
  onCountyPress: (countyId: string) => void;
  clusters: Cluster[];
  onMarkerPress: (cluster: Cluster) => void;
  accentColor: string;
  properties: Property[];
}

export interface MapCanvasHandle {
  animateToRegion: (region: MapRegionLike, durationMs?: number) => void;
}

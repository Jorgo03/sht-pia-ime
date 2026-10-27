// The website's maps (the app's web build), drawn with Leaflet and
// OpenStreetMap tiles like the Vite site was. Only the .web.tsx map
// components load this module, and only in the browser after hydration
// (use-leaflet.ts): Leaflet needs `window`, which the static export does not
// have. Native builds use react-native-maps and never reach this file.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { formatBubblePrice, markerColorFor, type Cluster } from '@/lib/cluster';
import { geometryCentroid } from '@/lib/geo';

import type { MapCanvasHandle, MapCanvasProps, MapRegionLike } from '../map-canvas.types';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const toBounds = (r: MapRegionLike) =>
  L.latLngBounds(
    [r.latitude - r.latitudeDelta / 2, r.longitude - r.longitudeDelta / 2],
    [r.latitude + r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2],
  );

const toRegion = (map: any): MapRegionLike => {
  const b = map.getBounds();
  const c = b.getCenter();
  return {
    latitude: c.lat,
    longitude: c.lng,
    latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
    longitudeDelta: Math.abs(b.getEast() - b.getWest()),
  };
};

// Only numbers and the compact price ever go into marker HTML, but escape
// anyway: this is the one place app data becomes markup.
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Centred on the coordinate, like the native markers' anchor {0.5, 0.5}.
const htmlIcon = (html: string) =>
  L.divIcon({ html: `<div style="transform:translate(-50%,-50%);display:inline-block">${html}</div>`, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });

// Same look as components/map/cluster-marker.tsx: a price bubble for one
// listing, a count bubble for a cluster.
function clusterIcon(cluster: Cluster, colors: AtticoPalette) {
  const count = cluster.properties.length;
  const single = count === 1;
  const bg = single ? markerColorFor(cluster.properties[0].listing_type) : colors.primary;
  const border = single ? '#FFFFFF' : colors.accent;
  const label = single ? formatBubblePrice(cluster.properties[0].price, cluster.properties[0].currency) : String(count);
  return htmlIcon(
    `<div style="background:${bg};border:1.5px solid ${border};border-radius:${single ? 14 : 18}px;` +
      `padding:6px ${single ? 10 : 12}px;min-width:${single ? 44 : 36}px;box-sizing:border-box;text-align:center;` +
      `box-shadow:0 2px 4px rgba(0,0,0,.3);color:${colors.textPrimary};font:700 13px ${Fonts.sansBold},Manrope,sans-serif;` +
      `white-space:nowrap;cursor:pointer">${esc(label)}</div>`,
  );
}

// Same look as components/map/county-marker.tsx.
function countyIcon(count: number, colors: AtticoPalette) {
  return htmlIcon(
    `<div style="width:44px;height:44px;border-radius:22px;background:${colors.accent};border:2px solid #fff;` +
      `box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 5px rgba(0,0,0,.35);` +
      `color:#fff;font:700 15px ${Fonts.sansBold},Manrope,sans-serif;cursor:pointer">${esc(String(count))}</div>`,
  );
}

function pinIcon(colors: AtticoPalette) {
  return htmlIcon(
    `<div style="width:22px;height:22px;border-radius:11px;background:${colors.accent};border:3px solid #fff;` +
      `box-sizing:border-box;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  );
}

/** Creates the map on a div, keeps it sized to its box, removes it on unmount. */
function useLeaflet(options: Record<string, unknown>, init: (map: any) => void) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { attributionControl: true, ...options });
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    init(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Created once; later prop changes are applied by the callers' effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { el, mapRef };
}

const FILL = { position: 'absolute', inset: 0 } as const;

export function ExploreMap({
  handleRef,
  colors,
  initialRegion,
  onRegionChangeComplete,
  onMapPress,
  isRegionOverview,
  countyGeojson,
  countyGroups,
  onCountyPress,
  clusters,
  onMarkerPress,
  accentColor,
  bottomInset = 0,
}: MapCanvasProps & { handleRef: Ref<MapCanvasHandle>; colors: AtticoPalette; bottomInset?: number }) {
  // Callbacks change identity on every parent render; the map listens once.
  const handlers = useRef({ onRegionChangeComplete, onMapPress, onCountyPress, onMarkerPress });
  useEffect(() => {
    handlers.current = { onRegionChangeComplete, onMapPress, onCountyPress, onMarkerPress };
  });
  const overlay = useRef<any>(null);

  // No +/- buttons, like the native map: pinch, scroll and double-tap zoom.
  const { el, mapRef } = useLeaflet({ zoomControl: false }, (map) => {
    // Listen first: on a new map fitBounds fires 'moveend' synchronously, so
    // a listener added after it never heard the first view, and the results
    // stayed on the fixed starting box (cutting off Sarandë, Ksamil, Theth)
    // until the first pan.
    map.on('moveend', () => handlers.current.onRegionChangeComplete(toRegion(map)));
    map.fitBounds(toBounds(initialRegion));
    overlay.current = L.layerGroup().addTo(map);
    map.on('click', () => handlers.current.onMapPress());
  });

  useImperativeHandle(handleRef, () => ({
    animateToRegion: (region, durationMs = 500) => {
      // Fits the target above the tab bar, like the native map's mapPadding.
      mapRef.current?.flyToBounds(toBounds(region), {
        duration: durationMs / 1000,
        paddingBottomRight: [0, bottomInset],
      });
    },
  }));

  // The attribution sat in the bottom-right corner under the floating tab
  // bar, at every width; OpenStreetMap's licence needs it visible.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().querySelectorAll('.leaflet-bottom').forEach((corner: HTMLElement) => {
      corner.style.bottom = `${bottomInset}px`;
    });
  }, [bottomInset, mapRef]);

  useEffect(() => {
    const group = overlay.current;
    if (!group) return;
    group.clearLayers();
    if (isRegionOverview) {
      L.geoJSON(countyGeojson, {
        style: { color: accentColor, weight: 1, fillColor: 'rgb(255,107,0)', fillOpacity: 0.06 },
        interactive: false,
      }).addTo(group);
      for (const county of countyGroups) {
        const c = geometryCentroid(county.geometry);
        L.marker([c.latitude, c.longitude], { icon: countyIcon(county.count, colors), keyboard: false })
          .on('click', () => handlers.current.onCountyPress(county.id))
          .addTo(group);
      }
    } else {
      for (const cluster of clusters) {
        L.marker([cluster.latitude, cluster.longitude], { icon: clusterIcon(cluster, colors), keyboard: false })
          .on('click', () => handlers.current.onMarkerPress(cluster))
          .addTo(group);
      }
    }
  }, [isRegionOverview, countyGeojson, countyGroups, clusters, colors, accentColor]);

  return <div ref={el} style={FILL} />;
}

export function PreviewMap({ latitude, longitude, colors }: { latitude: number; longitude: number; colors: AtticoPalette }) {
  // A still picture of the spot, like the native preview: no panning or
  // zooming; "Open in Maps" next to it does the navigation.
  const { el } = useLeaflet(
    { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false },
    (map) => {
      map.fitBounds(toBounds({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }));
      // keyboard: false — Leaflet otherwise makes every marker an unnamed
      // keyboard "button", even this one that does nothing.
      L.marker([latitude, longitude], { icon: pinIcon(colors), interactive: false, keyboard: false }).addTo(map);
    },
  );
  return <div ref={el} style={FILL} />;
}

const TIRANA: MapRegionLike = { latitude: 41.3275, longitude: 19.8187, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const STREET_DELTA = 0.004;

export function PickerMap({
  latitude,
  longitude,
  focus,
  onPick,
  colors,
}: {
  latitude: number | null;
  longitude: number | null;
  focus?: { latitude: number; longitude: number } | null;
  onPick: (latitude: number, longitude: number) => void;
  colors: AtticoPalette;
}) {
  // Same rules as the native picker: a tap or a drag sets the pin; `focus`
  // (a chosen road or city) only moves the view and never drops a pin.
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  });
  const marker = useRef<any>(null);
  const hasPin = latitude != null && longitude != null;

  const { mapRef, el } = useLeaflet({ zoomControl: false }, (map) => {
    map.fitBounds(
      toBounds(hasPin ? { latitude: latitude as number, longitude: longitude as number, latitudeDelta: 0.01, longitudeDelta: 0.01 } : TIRANA),
    );
    map.on('click', (e: any) => pick.current(e.latlng.lat, e.latlng.lng));
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasPin) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const at: [number, number] = [latitude as number, longitude as number];
    if (marker.current) {
      marker.current.setLatLng(at);
      return;
    }
    // Placed by tapping the map and moved by dragging; not a keyboard control.
    marker.current = L.marker(at, { icon: pinIcon(colors), draggable: true, keyboard: false })
      .on('dragend', () => {
        const p = marker.current.getLatLng();
        pick.current(p.lat, p.lng);
      })
      .addTo(map);
  }, [hasPin, latitude, longitude, colors, mapRef]);

  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyToBounds(
      toBounds({ latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA }),
      { duration: 0.65 },
    );
    // Keyed on the coordinates, not the object (same reason as native).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.latitude, focus?.longitude]);

  return <div ref={el} style={FILL} />;
}

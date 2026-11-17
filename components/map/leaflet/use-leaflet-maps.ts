import { useEffect, useState } from 'react';

type LeafletMaps = typeof import('./leaflet-maps');

/**
 * Loads the Leaflet maps in the browser after hydration (null until then,
 * and always during the static export, where there is no `window`). Callers
 * show their placeholder meanwhile, so the pre-rendered HTML and the first
 * browser render stay identical.
 */
export function useLeafletMaps(): LeafletMaps | null {
  const [maps, setMaps] = useState<LeafletMaps | null>(null);
  useEffect(() => {
    let active = true;
    import('./leaflet-maps').then((mod) => {
      if (active) setMaps(mod);
    });
    return () => {
      active = false;
    };
  }, []);
  return maps;
}

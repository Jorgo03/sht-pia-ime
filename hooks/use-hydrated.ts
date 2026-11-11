import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the website's page is pre-rendered and during its first draw in
 * the browser, true afterwards; always true on phones after the first render.
 *
 * A screen whose first answer depends on its address (/user/<id>) must draw the
 * same thing on both sides of that line: the pre-render does not know the real
 * id, and drawing "not available" there and the profile in the browser is
 * React error #418 (the page tore down and redrew).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

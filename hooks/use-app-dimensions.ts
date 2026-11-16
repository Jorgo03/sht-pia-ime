import { usePathname } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { DESKTOP_MIN_WIDTH, IS_WEB, WEB_MAX_WIDTH, webColumnWidth } from '@/constants/web-frame';
import { useHydrated } from '@/hooks/use-hydrated';

/**
 * The size the app is actually drawn at: the window on a phone or tablet;
 * on the web, the column the current address is drawn in
 * (constants/web-frame): phone-width for most screens, up to
 * DESKTOP_MAX_WIDTH for Home, Search and a listing on a desktop browser.
 * The pre-rendered page and the browser's first draw are always the phone
 * column, so the two match (React error #418 otherwise).
 */
export function useAppDimensions() {
  const window = useWindowDimensions();
  const pathname = usePathname();
  const hydrated = useHydrated();
  if (!IS_WEB) return window;
  return { ...window, width: hydrated ? webColumnWidth(pathname, window.width) : Math.min(window.width, WEB_MAX_WIDTH) };
}

/** True on the website's desktop layout (wide browser, desktop address). */
export function useIsDesktopWeb(): boolean {
  const { width } = useAppDimensions();
  return IS_WEB && width >= DESKTOP_MIN_WIDTH;
}

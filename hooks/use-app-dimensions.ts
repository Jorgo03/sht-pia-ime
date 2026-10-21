import { useWindowDimensions } from 'react-native';

import { IS_WEB, WEB_MAX_WIDTH } from '@/constants/web-frame';

/**
 * The size the app is actually drawn at: the window on a phone or tablet,
 * and the phone-width column (constants/web-frame.ts) on the web, so a wide
 * browser never switches the app into its tablet layout.
 */
export function useAppDimensions() {
  const window = useWindowDimensions();
  return IS_WEB ? { ...window, width: Math.min(window.width, WEB_MAX_WIDTH) } : window;
}

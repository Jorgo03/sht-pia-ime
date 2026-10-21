import { Platform, type ViewStyle } from 'react-native';

/**
 * The website is the Expo app's web build, shown as a phone-width column
 * centred on wide screens (it should look like the app, not a stretched
 * page). Native builds never use any of this.
 */
export const WEB_MAX_WIDTH = 480;

export const IS_WEB = Platform.OS === 'web';

/**
 * Keeps a full-width block (a sheet, a modal card) inside the column on the
 * web. Auto side margins centre it whether it sits in a flex container or is
 * absolutely positioned with left/right 0. Null on native.
 */
export const webColumn: ViewStyle | null = IS_WEB
  ? { width: '100%', maxWidth: WEB_MAX_WIDTH, alignSelf: 'center', marginHorizontal: 'auto' }
  : null;

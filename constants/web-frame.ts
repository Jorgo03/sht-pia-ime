import { Platform, type ViewStyle } from 'react-native';

/**
 * The website is the Expo app's web build, shown as a phone-width column
 * centred on wide screens (it should look like the app, not a stretched
 * page). Native builds never use any of this.
 */
export const WEB_MAX_WIDTH = 480;

export const IS_WEB = Platform.OS === 'web';

/**
 * Widest a form, a list of rows, a page of text or a sheet is drawn on a
 * phone or tablet. An unfolded Galaxy Fold in landscape or a spanned Surface
 * Duo is 830-1110 wide, where a full-width text field or settings row is hard
 * to read and reach. The widest phone (~430) is well under it.
 */
export const READABLE_MAX_WIDTH = 640;

/**
 * Keeps a full-width block (a sheet, a modal card) inside the column: the
 * phone-width column on the web, READABLE_MAX_WIDTH on a wide native screen.
 * The parent must be a flex container (every sheet's backdrop is); auto side
 * margins also centre it on the web when it is absolutely positioned.
 */
export const sheetColumn: ViewStyle = IS_WEB
  ? { width: '100%', maxWidth: WEB_MAX_WIDTH, alignSelf: 'center', marginHorizontal: 'auto' }
  : { width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center' };

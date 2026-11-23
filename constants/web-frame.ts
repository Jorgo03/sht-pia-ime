import { Platform, type ViewStyle } from 'react-native';

/**
 * The website is the Expo app's web build, shown as a phone-width column
 * centred on wide screens (it should look like the app, not a stretched
 * page). Native builds never use any of this.
 */
// EXPO_PUBLIC_WEB_MAX_WIDTH is for test builds only: a wider column lets a
// browser draw the tablet and unfolded-foldable layouts, which native devices
// get from their real width. Production builds leave it unset.
export const WEB_MAX_WIDTH = Number(process.env.EXPO_PUBLIC_WEB_MAX_WIDTH) || 480;

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

/**
 * The website (DECISIONS.md W4, W5): a classic site with a full-width header
 * and footer, not the phone app in a column. Public "website" pages (Home,
 * Search, a listing, the wanted-homes board, the guide, agencies, legal
 * pages) are drawn up to SITE_MAX_WIDTH; signed-in app screens (profile,
 * messages, forms) in a centred APP_SCREEN_MAX_WIDTH column, where forms and
 * lists stay readable. At DESKTOP_MIN_WIDTH and up, Home, Search and a
 * listing switch to their desktop layouts.
 */
export const DESKTOP_MIN_WIDTH = 1024;
export const DESKTOP_MAX_WIDTH = 1280;
export const SITE_MAX_WIDTH = DESKTOP_MAX_WIDTH;
export const APP_SCREEN_MAX_WIDTH = 720;

/** Addresses drawn as wide website pages. */
export function isWebsiteRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    /^\/(explore|wanted|guide|agents|privacy|terms|cookies|pricing|compare|profile)$/.test(pathname) ||
    /^\/(property|agent|user)\/[^/]+$/.test(pathname) ||
    /^\/agent-dashboard$/.test(pathname) ||
    // The sign-in screen's dusk artwork runs the page's full width; the
    // profile's own content stays in its readable column.
    // Messages is two panes on a desktop (the list beside the open chat).
    /^\/messages(\/[^/]+)?$/.test(pathname)
  );
}

/** Width of the website's column for this address and browser width. */
export function webColumnWidth(pathname: string, windowWidth: number): number {
  return Math.min(windowWidth, isWebsiteRoute(pathname) ? SITE_MAX_WIDTH : APP_SCREEN_MAX_WIDTH);
}

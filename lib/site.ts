/**
 * The public website, used to build links the phone app hands to other apps
 * (share sheet, legal pages). Listings live at `${SITE_URL}/property/<id>` —
 * the web app's own route — so a shared link opens for anyone, app or not.
 *
 * Override with EXPO_PUBLIC_SITE_URL once a custom domain is live. Public, not
 * a secret, so the EXPO_PUBLIC_ prefix is correct.
 */
const DEFAULT_SITE_URL = 'https://real-estate-app-hazel-seven.vercel.app';

const fromEnv = (process.env.EXPO_PUBLIC_SITE_URL ?? '').trim();

export const SITE_URL = (fromEnv.startsWith('https://') ? fromEnv : DEFAULT_SITE_URL).replace(/\/+$/, '');

export const propertyUrl = (id: string): string => `${SITE_URL}/property/${encodeURIComponent(id)}`;

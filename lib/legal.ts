/**
 * Legal document URLs — Privacy Policy and Terms of Service.
 *
 * Both stores require a publicly reachable Privacy Policy before an app that
 * collects personal data can be published (Apple App Privacy; Google Play Data
 * Safety). This module is the single place those URLs are configured, for the
 * Expo app and — via `src/lib/legal.js`, which re-exports the same values — the
 * web app.
 *
 * The web app hosts both documents itself (src/features/legal, routes
 * /privacy and /terms), so by default the phone app links to those pages on the
 * public site (lib/site.ts). Earlier this module refused to default to anything,
 * since a link that 404s during store review is worse than no link. That held
 * while the pages did not exist. Now they do, and the default is a real page.
 *
 * Override either one with a full https URL if the documents move:
 *
 *   EXPO_PUBLIC_PRIVACY_POLICY_URL=https://.../privacy
 *   EXPO_PUBLIC_TERMS_URL=https://.../terms
 *
 * These are public by design — they are just published web addresses — so the
 * EXPO_PUBLIC_ / VITE_ prefix is correct here and carries no secret.
 */

import { SITE_URL } from './site';

const clean = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  // Only accept a real absolute https URL. An empty string, a placeholder, or
  // a relative path would all produce a dead link in front of a reviewer.
  return s.startsWith('https://') ? s : null;
};

export const PRIVACY_POLICY_URL = clean(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL) ?? `${SITE_URL}/privacy`;
export const TERMS_URL = clean(process.env.EXPO_PUBLIC_TERMS_URL) ?? `${SITE_URL}/terms`;

/**
 * Contact address printed on the Privacy and Terms pages of the website (the
 * Expo app's web build). Same rule as the Vite site's VITE_LEGAL_CONTACT_EMAIL:
 * unset or not an address, the pages point people to the in-app controls
 * instead of printing an address nobody reads.
 *
 *   EXPO_PUBLIC_LEGAL_CONTACT_EMAIL=privacy@yourdomain
 */
const email = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
};

export const LEGAL_CONTACT_EMAIL = email(process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL);

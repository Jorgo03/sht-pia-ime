/**
 * Legal document URLs — Privacy Policy and Terms of Service.
 *
 * Both stores require a publicly reachable Privacy Policy before an app that
 * collects personal data can be published (Apple App Privacy; Google Play Data
 * Safety). This module is the single place those URLs are configured, for the
 * Expo app and — via `src/lib/legal.js`, which re-exports the same values — the
 * web app.
 *
 * OWNER ACTION REQUIRED: set these in the environment. They are deliberately
 * NOT hardcoded to a placeholder domain: a link that 404s during store review
 * is worse than a link that is honestly absent, because a reviewer will click
 * it. Until they are set, `hasLegalUrls()` is false and the UI hides the links
 * rather than showing something broken.
 *
 *   EXPO_PUBLIC_PRIVACY_POLICY_URL=https://.../privacy
 *   EXPO_PUBLIC_TERMS_URL=https://.../terms
 *
 * These are public by design — they are just published web addresses — so the
 * EXPO_PUBLIC_ / VITE_ prefix is correct here and carries no secret.
 */

const clean = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  // Only accept a real absolute https URL. An empty string, a placeholder, or
  // a relative path would all produce a dead link in front of a reviewer.
  return s.startsWith('https://') ? s : null;
};

export const PRIVACY_POLICY_URL = clean(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
export const TERMS_URL = clean(process.env.EXPO_PUBLIC_TERMS_URL);

/** True only when at least one legal URL is genuinely configured. */
export const hasLegalUrls = (): boolean => Boolean(PRIVACY_POLICY_URL || TERMS_URL);

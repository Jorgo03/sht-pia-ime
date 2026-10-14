/**
 * Legal document URLs for the web app — the Vite-side counterpart of
 * `lib/legal.ts` (Expo). Two files because the two bundlers expose environment
 * variables differently: Vite uses `import.meta.env.VITE_*`, Expo uses
 * `process.env.EXPO_PUBLIC_*`. The behaviour is identical.
 *
 * OWNER ACTION REQUIRED: set these in `.env.local` / the Vercel project.
 * Deliberately not defaulted to a placeholder domain — a link that 404s during
 * store review is worse than an absent one, because a reviewer will click it.
 *
 *   VITE_PRIVACY_POLICY_URL=https://.../privacy
 *   VITE_TERMS_URL=https://.../terms
 */

const clean = (v) => {
  const s = (v ?? '').trim()
  // Only a real absolute https URL counts as configured.
  return s.startsWith('https://') ? s : null
}

export const PRIVACY_POLICY_URL = clean(import.meta.env.VITE_PRIVACY_POLICY_URL)
export const TERMS_URL = clean(import.meta.env.VITE_TERMS_URL)

export const hasLegalUrls = () => Boolean(PRIVACY_POLICY_URL || TERMS_URL)

/**
 * Contact address printed on /privacy and /terms. The pages themselves now live
 * in this web app (src/features/legal), so the web links to them by route and
 * never needs the URLs above; those remain for the Expo app, which opens them
 * in a browser.
 *
 *   VITE_LEGAL_CONTACT_EMAIL=privacy@yourdomain
 *
 * Unset, the pages point people to the in-app Profile controls instead of
 * printing an address nobody reads.
 */
const email = (v) => {
  const s = (v ?? '').trim()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null
}
export const LEGAL_CONTACT_EMAIL = email(import.meta.env.VITE_LEGAL_CONTACT_EMAIL)

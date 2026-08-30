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

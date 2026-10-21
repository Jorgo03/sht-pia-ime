import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// The HTML around every page of the website (the app's web build). Web only:
// expo-router uses it at export time and native builds never see it.
//
// Kept from the Vite site's index.html, which this build replaces:
// - lang, theme colour, icons and the site-wide link-preview tags (each page
//   then sets its own title and description; see components/web/page-head);
// - the mobile OAuth relay below, which must run before the app's script.

// Mobile OAuth relay (same rules as the Vite site's index.html and
// AuthCallback.jsx). Expo Go's exp:// callback cannot be allow-listed in
// Supabase, so the app sends ?rt=<its own address> through this site's
// /auth/callback and this hands the result straight back. It runs before the
// bundle because the Supabase client reads ?code= as soon as it is created,
// and that code belongs to the phone. Only the app's own schemes are allowed:
// forwarding to http(s) would be an open redirect that leaks the code.
const OAUTH_RELAY = `(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var target = params.get('rt');
    if (!target) return;
    var parsed = new URL(target);
    if (parsed.protocol !== 'exp:' && parsed.protocol !== 'shtepia-ime:') return;
    params.delete('rt');
    params.forEach(function (value, key) { parsed.searchParams.set(key, value); });
    if (window.location.hash && window.location.hash.length > 1) parsed.hash = window.location.hash;
    window.location.replace(parsed.toString());
  } catch (e) {
    /* fall through: app/auth/callback.tsx shows a tappable link */
  }
})();`;

// Page background before the app paints, in both themes, so there is no
// white flash; and the dynamic viewport height, so mobile browsers' address
// bars do not cut off the tab bar (100vh is taller than the visible area).
const BASE_CSS = `
html, body, #root { height: 100%; }
body { background-color: #f1ede6; overscroll-behavior-y: none; }
@media (prefers-color-scheme: dark) { body { background-color: #0e0b09; } }
@supports (height: 100dvh) { html, body, #root { height: 100dvh; } }
`;

// Link previews need an absolute image URL; the site address is set per
// deployment (EXPO_PUBLIC_SITE_URL). Without it the tag is left out rather
// than pointing at a relative path crawlers cannot use.
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="sq">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ff7d1a" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Shtëpia.ime" />
        <meta property="og:locale" content="sq_AL" />
        {SITE_URL.startsWith('https://') ? (
          <>
            <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
          </>
        ) : null}
        <meta name="twitter:card" content="summary_large_image" />
        <script dangerouslySetInnerHTML={{ __html: OAUTH_RELAY }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

import '../styles/loading-screen.css'

// Shared loading indicator: a house outline sits dim, and a bright neon
// version of the same stroke rises into view bottom-to-top (a clipPath rect
// sliding up over it) — a "sign powering on" reveal, not a silhouette
// filling with liquid. Plus an ambient bloom behind it, the brand wordmark,
// and a small decorative sparkle.
//
//   <LoadingScreen state="splash" />                          — app boot, wordmark only
//   <LoadingScreen state="oauth" text={t('authCallback.signingIn')} />
//   <LoadingScreen state="oauth" text={[t('authCallback.signingIn'), t('authCallback.preparingMatches')]} />
//
// `text` is caller-supplied (i18next) — this component owns no copy other
// than the "Shtëpia.ime" brand mark itself (proper nouns aren't translated
// anywhere else in the app either — see Header.jsx). An array crosscades
// between its first two entries via pure CSS (no JS timer); anything beyond
// two is ignored — nothing in the app needs a third message today, and a
// generically-N-sized pure-CSS crossfade isn't worth the complexity until
// something does. `fullScreen` (default true) covers the viewport; pass
// false to fill whatever container it's placed in instead.
export default function LoadingScreen({ state = 'splash', text, fullScreen = true, className = '' }) {
  const isOAuth = state === 'oauth'
  const messages = (Array.isArray(text) ? text.filter(Boolean) : text ? [text] : []).slice(0, 2)
  const cycling = messages.length > 1

  return (
    <div
      className={`loading-screen ${fullScreen ? 'loading-screen--full' : ''} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="loading-screen__bloom" aria-hidden="true" />

      <div className="loading-screen__content">
        <svg
          className="loading-screen__icon"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="loadingNeonGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="blur1" />
              <feGaussianBlur stdDeviation="7" result="blur2" in="SourceGraphic" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="loadingWhiteGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Rises bottom→top to reveal the neon layer beneath it */}
            <clipPath id="loadingRiseClip" clipPathUnits="userSpaceOnUse">
              <rect x="-10" y="0" width="120" height="110" className="loading-screen__rise-rect" />
            </clipPath>
          </defs>

          {/* Dim base outline — always visible; this is the "off" state */}
          <g
            className="loading-screen__ghost"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="50,8 10,44 90,44" />
            <line x1="17" y1="40" x2="17" y2="84" />
            <line x1="83" y1="40" x2="83" y2="84" />
            <line x1="17" y1="84" x2="36" y2="84" />
            <polyline points="36,84 36,62 64,62 64,84" />
            <line x1="64" y1="84" x2="83" y2="84" />
          </g>

          {/* Inner roofline highlight — decorative, always visible */}
          <g
            className="loading-screen__highlight"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#loadingWhiteGlow)"
          >
            <polyline points="50,16 20,45" />
            <polyline points="50,16 80,45" />
          </g>

          {/* Bright neon layer — same path as the ghost, clipped so only the
              risen portion shows */}
          <g
            className="loading-screen__neon"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#loadingNeonGlow)"
            clipPath="url(#loadingRiseClip)"
          >
            <polyline points="50,8 10,44 90,44" />
            <line x1="17" y1="40" x2="17" y2="84" />
            <line x1="83" y1="40" x2="83" y2="84" />
            <line x1="17" y1="84" x2="36" y2="84" />
            <polyline points="36,84 36,62 64,62 64,84" />
            <line x1="64" y1="84" x2="83" y2="84" />
          </g>
        </svg>

        <div className="loading-screen__wordmark">
          Shtëpia<span className="loading-screen__wordmark-ime">.ime</span>
        </div>

        {isOAuth && messages.length > 0 && (
          <div className="loading-screen__text-slot">
            <p className="loading-screen__text loading-screen__text--a">{messages[0]}</p>
            {cycling && <p className="loading-screen__text loading-screen__text--b">{messages[1]}</p>}
          </div>
        )}
      </div>

      <svg className="loading-screen__sparkle" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1 L11.2 8.8 L19 10 L11.2 11.2 L10 19 L8.8 11.2 L1 10 L8.8 8.8 Z" />
      </svg>

      <span className="sr-only">{messages[0] || 'Shtëpia.ime'}</span>
    </div>
  )
}

import '../styles/loading-screen.css'

// Shared loading indicator: a minimalist house outline whose interior fills
// with brand orange from bottom to top, then holds, fades and loops.
//
//   <LoadingScreen state="splash" />                          — app boot, no text
//   <LoadingScreen state="oauth" text={t('authCallback.signingIn')} />
//
// `text` is caller-supplied (i18next) — this component owns no copy of its
// own. `fullScreen` (default true) covers the viewport; pass false to fill
// whatever container it's placed in instead.
export default function LoadingScreen({ state = 'splash', text, fullScreen = true, className = '' }) {
  const isOAuth = state === 'oauth'

  return (
    <div
      className={`loading-screen ${fullScreen ? 'loading-screen--full' : ''} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="loading-screen__icon">
        <svg viewBox="0 0 240 240" width="100%" height="100%" aria-hidden="true">
          <defs>
            {/* House silhouette with the door punched out (evenodd) — the
                rising fill is clipped to this, so the door stays open. */}
            <clipPath id="loadingHouseClip" clipPathUnits="userSpaceOnUse">
              <path
                fillRule="evenodd"
                d="M40,200 L40,110 L120,40 L200,110 L200,200 Z M104,200 L104,148 L136,148 L136,200 Z"
              />
            </clipPath>
          </defs>

          <g clipPath="url(#loadingHouseClip)">
            <rect className="loading-screen__fill" x="40" y="40" width="160" height="160" />
          </g>

          <path
            className="loading-screen__outline"
            fill="none"
            d="M40,200 L40,110 L120,40 L200,110 L200,200 Z"
          />
          <path
            className="loading-screen__outline"
            fill="none"
            d="M104,200 L104,148 L136,148 L136,200"
          />
        </svg>
      </div>

      {isOAuth ? (
        <p className="loading-screen__text">{text}</p>
      ) : (
        <span className="sr-only">{text || 'Shtëpia.ime'}</span>
      )}
    </div>
  )
}

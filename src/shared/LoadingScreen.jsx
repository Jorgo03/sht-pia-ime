import { useEffect, useState } from 'react'
import '../styles/loading-screen.css'

// How long each message is shown before crossfading to the next, in
// cycling mode. Set as an inline CSS custom property below so the JS timer
// and the CSS fade animation can never drift out of sync with each other.
const CYCLE_MS = 2600

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Shared loading indicator: a minimalist house outline whose interior fills
// with brand orange from bottom to top, then holds, fades and loops.
//
//   <LoadingScreen state="splash" />                          — app boot, no text
//   <LoadingScreen state="oauth" text={t('authCallback.signingIn')} />
//   <LoadingScreen state="oauth" text={[t('authCallback.signingIn'), t('authCallback.preparingMatches')]} />
//
// `text` is caller-supplied (i18next) — this component owns no copy of its
// own. Pass an array to crossfade between messages instead of one static
// line (falls back to static if the array has 0–1 items, or under
// prefers-reduced-motion — a mid-loop content swap is itself motion).
// `fullScreen` (default true) covers the viewport; pass false to fill
// whatever container it's placed in instead.
export default function LoadingScreen({ state = 'splash', text, fullScreen = true, className = '' }) {
  const isOAuth = state === 'oauth'
  const messages = Array.isArray(text) ? text.filter(Boolean) : text ? [text] : []
  const cycling = messages.length > 1

  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!cycling || prefersReducedMotion()) return
    const id = setInterval(() => setIdx((i) => (i + 1) % messages.length), CYCLE_MS)
    return () => clearInterval(id)
    // messages.length, not messages itself — a caller re-rendering with a
    // new-but-equal array (common with inline t()/array literals) shouldn't
    // restart the timer and jump back to message 0.
  }, [cycling, messages.length])

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
        cycling ? (
          <p
            className="loading-screen__text loading-screen__text--cycle"
            style={{ animationDuration: `${CYCLE_MS}ms` }}
          >
            {messages[idx]}
          </p>
        ) : (
          <p className="loading-screen__text">{messages[0]}</p>
        )
      ) : (
        <span className="sr-only">{messages[0] || 'Shtëpia.ime'}</span>
      )}
    </div>
  )
}

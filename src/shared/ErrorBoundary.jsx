import { Component } from 'react'
import i18n from '../i18n/index.js'

/**
 * Top-level crash guard. Without one, any uncaught render error unmounts the
 * whole React tree and the user is left on a blank white page with nothing to
 * act on — no message, no way back, and (in production) no console open to
 * see why.
 *
 * Deliberately a class: `getDerivedStateFromError`/`componentDidCatch` have no
 * hook equivalent, and pulling in react-error-boundary just for this would add
 * a dependency for something the platform already provides.
 *
 * It reads the i18n singleton directly rather than `useTranslation`, since a
 * class can't call hooks and this must not itself depend on React context that
 * may be part of what just crashed. If i18n is the thing that broke, `t()`
 * returns the key — still a rendered page, not a blank one.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Dev only: in production this would be the hook for a reporting service
    // (none is wired up yet — see AUDIT.md). Never rendered to the user.
    if (import.meta.env?.DEV) {
      console.error('[ErrorBoundary] uncaught render error:', error, info?.componentStack)
    }
  }

  handleRetry = () => {
    // A full reload rather than just clearing the flag: the crash may have
    // left context/state (auth session, query cache) partly torn down, and
    // re-rendering the same broken tree usually just crashes again.
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const t = (key) => i18n.t(key)

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: 'var(--fho-bg, #16120f)', color: 'var(--fho-text, #f5f0e8)' }}
      >
        <div
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{ background: 'var(--fho-orange-glow, rgba(255,125,26,0.14))' }}
        >
          ⚠️
        </div>

        <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--fho-text, #f5f0e8)' }}>
          {t('errors.generic')}
        </h1>

        {/* The message itself is never shown — it can carry internal detail
            (query text, ids). The stack stays in the dev console only. */}
        <button
          type="button"
          onClick={this.handleRetry}
          className="cursor-pointer rounded-full px-7 py-3 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--fho-orange-1, #ff7d1a), var(--fho-orange-2, #e85d00))' }}
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }
}

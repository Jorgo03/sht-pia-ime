import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AI_CHAT_ENABLED } from '../../lib/features'
import EraAvatar from './EraAvatar'

// The chat itself loads the first time someone opens it.
const EraChat = lazy(() => import('./EraChat'))

// Pages where a floating button would be in the way: the full chat itself,
// sign-in, and the listing form, whose own action bar sits at the bottom.
const HIDDEN = [/^\/assistant/, /^\/login/, /^\/signup/, /^\/forgot-password/, /^\/listing\/new/, /^\/listing\/[^/]+\/edit/, /^\/messages\//]

/**
 * Era in the bottom-right corner of every page: a button with her portrait,
 * and a chat window above it. On a phone the window takes the whole screen.
 * Escape or the close button shut it and return focus to the button; moving
 * to another page closes it too, so a link in an answer shows that page.
 */
export default function EraLauncher() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const buttonRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const [lastPath, setLastPath] = useState(pathname)

  if (lastPath !== pathname) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Focus moves into the window when it opens: ready to type on a computer;
  // on a touch screen the window itself takes focus (so a screen reader
  // starts there) and the keyboard waits for a tap.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      if (window.matchMedia('(pointer: fine)').matches && inputRef.current) inputRef.current.focus()
      else panelRef.current?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [open])

  // On a phone the window covers the page: the page behind it must not scroll,
  // and keyboard and screen-reader users must not land in it (inert).
  const [fullScreen, setFullScreen] = useState(false)
  useEffect(() => {
    if (!open) return
    const mq = window.matchMedia('(max-width: 599px)')
    const sync = () => setFullScreen(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [open])
  useEffect(() => {
    if (!open || !fullScreen) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const behind = [...document.querySelectorAll('body > #root > :not(.era-panel):not(.era-launcher)')]
    behind.forEach((el) => el.setAttribute('inert', ''))
    return () => {
      document.body.style.overflow = overflow
      behind.forEach((el) => el.removeAttribute('inert'))
    }
  }, [open, fullScreen])

  if (!AI_CHAT_ENABLED || HIDDEN.some((r) => r.test(pathname))) return null

  const show = () => {
    setLoaded(true)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      {loaded && (
        <section
          ref={panelRef}
          tabIndex={-1}
          className={`era-panel${open ? ' is-open' : ''}`}
          role="dialog"
          aria-modal={open && fullScreen ? 'true' : undefined}
          aria-labelledby="era-title"
          hidden={!open}
        >
          <Suspense fallback={<div className="era-loading" aria-busy="true"><EraAvatar size={56} /></div>}>
            <EraChat variant="panel" onClose={close} inputRef={inputRef} />
          </Suspense>
        </section>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`era-launcher${open ? ' is-open' : ''}`}
        onClick={() => (open ? close() : show())}
        aria-expanded={open}
        aria-label={open ? t('common.close') : t('era.cta')}
      >
        <span className="era-launcher-face">
          <EraAvatar size={52} />
          <span className="era-online" aria-hidden="true" />
        </span>
        <span className="era-launcher-text" aria-hidden="true">
          <strong>{t('era.name')}</strong>
          <small>{t('era.cta')}</small>
        </span>
      </button>
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { advance, preparePhrases, stepDelay, visibleParts } from '@/src/features/home/lib/typewriter.js'

const BLINK_MS = 530

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The app's Home headline (components/home/hero-typewriter.tsx) for the
// website: the phrases in home.heroPhrases typed and deleted one by one, the
// second part in orange italic, with a blinking cursor. Same rules as the app
// (src/features/home/lib/typewriter.js). The height of the tallest phrase is
// kept, so nothing below it moves; a screen reader hears the first phrase
// once, not every letter; with reduced motion it simply shows that phrase.
export default function HeroTypewriter() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the phrases change with the language
  const phrases = useMemo(() => preparePhrases(t('home.heroPhrases', { returnObjects: true })), [lang])
  // A new language starts cleanly rather than mid-phrase.
  return <Typewriter key={lang} phrases={phrases} />
}

function Typewriter({ phrases }) {
  const [animated] = useState(() => phrases.length > 0 && !prefersReducedMotion())
  // Starts with the first phrase in full, so the page never opens blank.
  const [state, setState] = useState(() => ({ index: 0, count: phrases[0]?.graphemes.length ?? 0, phase: 'pause' }))
  const [cursorOn, setCursorOn] = useState(true)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')

  // Rests while the tab is in the background.
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  const running = animated && visible

  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => setState((s) => advance(s, phrases)), stepDelay(state, phrases, Math.random()))
    return () => clearTimeout(timer)
  }, [running, state, phrases])

  // Solid while typing; blinks only while resting on a finished phrase.
  const resting = state.phase === 'pause' || state.phase === 'gap'
  useEffect(() => {
    if (!running || !resting) return
    const timer = setInterval(() => setCursorOn((on) => !on), BLINK_MS)
    return () => {
      clearInterval(timer)
      setCursorOn(true)
    }
  }, [running, resting])

  if (phrases.length === 0) return null
  const first = phrases[0]
  const parts = animated ? visibleParts(phrases[state.index], state.count) : { lead: first.lead, accent: first.accent }

  return (
    <h1 id="hero-title" className="hero-type">
      <span className="visually-hidden">{first.full}</span>
      {/* Every phrase, invisible, in the same spot: the box is as tall as the tallest. */}
      <span className="hero-type-stack" aria-hidden="true">
        {phrases.map((p) => (
          <span key={p.full} className="hero-type-reserve">
            <span>{p.lead}</span>
            {p.accent && <em>{p.accent}</em>}
          </span>
        ))}
        <span className="hero-type-live">
          {/* The cursor follows the last typed character, on whichever line it is. */}
          <span>
            {parts.lead.replace(/\n$/, '')}
            {animated && !parts.accent && <Cursor on={cursorOn} />}
          </span>
          {parts.accent && (
            <em>
              {parts.accent}
              {animated && <Cursor on={cursorOn} />}
            </em>
          )}
        </span>
      </span>
    </h1>
  )
}

const Cursor = ({ on }) => <span className={`hero-cursor${on ? '' : ' is-off'}`}>|</span>

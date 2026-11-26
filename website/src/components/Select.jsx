import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

// The site's dropdown, in place of the browser's own list (which ignores the
// site's fonts, colours and dark theme). Same props as <select>: `value`,
// `onChange(event)` with `event.target.value`, and <option> children, so a
// <select> becomes a <Select> with nothing else changed. Works with the
// keyboard like a native select (arrows, Home/End, typing a letter, Enter,
// Escape) and announces itself to screen readers as a listbox.

function readOptions(children) {
  const out = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      const label = Children.toArray(child.props.children).join('')
      out.push({ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled, lang: child.props.lang })
    } else if (child.props?.children) {
      out.push(...readOptions(child.props.children))
    }
  })
  return out
}

const GAP = 6
const MAX_HEIGHT = 320

export default function Select({ value, onChange, children, className = '', id, disabled, 'aria-label': ariaLabel, 'aria-describedby': describedBy }) {
  const options = readOptions(children)
  const current = String(value ?? '')
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === current))
  const selected = options[selectedIndex]
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selectedIndex)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const typed = useRef({ text: '', at: 0 })
  const uid = useId()
  const listId = `${uid}-list`

  // Placed against the viewport, below the trigger or above it when there
  // is more room there, so no panel or dialog edge can cut the list off.
  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - GAP - 8
    const above = r.top - GAP - 8
    const up = below < Math.min(MAX_HEIGHT, 200) && above > below
    const width = Math.min(Math.max(r.width, 200), window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setPos({ left, width, maxHeight: Math.min(MAX_HEIGHT, up ? above : below), ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }) })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onMove = () => place()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open && pos) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, pos])

  const show = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const choose = (i) => {
    const o = options[i]
    setOpen(false)
    triggerRef.current?.focus()
    if (!o || o.disabled || o.value === current) return
    onChange?.({ target: { value: o.value }, currentTarget: { value: o.value } })
  }
  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i
    return from
  }

  const onKeyDown = (e) => {
    const k = e.key
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (k === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // closes only the list, not a dialog around it
      setOpen(false)
    } else if (k === 'Tab') setOpen(false)
    else if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => step(a, k === 'ArrowDown' ? 1 : -1))
    } else if (k === 'Home' || k === 'End' || k === 'PageUp' || k === 'PageDown') {
      e.preventDefault()
      setActive(k === 'Home' ? step(-1, 1) : k === 'End' ? step(options.length, -1) : (a) => step(Math.max(-1, Math.min(options.length, a + (k === 'PageDown' ? 8 : -8))), k === 'PageDown' ? -1 : 1))
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault()
      choose(active)
    } else if (k.length === 1 && /\S/.test(k)) {
      // Typing jumps to the first option that starts with what was typed.
      const now = Date.now()
      const text = (now - typed.current.at < 700 ? typed.current.text : '') + k.toLowerCase()
      typed.current = { text, at: now }
      const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(text))
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`sel-trigger ${className}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${uid}-${active}` : undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label ?? ''}` : undefined}
        aria-describedby={describedBy}
        onClick={(e) => {
          e.preventDefault()
          if (open) setOpen(false)
          else show()
        }}
        onKeyDown={onKeyDown}
      >
        <span className="sel-value" lang={selected?.lang}>{selected?.label ?? ''}</span>
        <ChevronDown className="sel-chevron" size={16} aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="sel-list"
          style={pos}
          // Keeps focus on the trigger while choosing.
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              id={`${uid}-${i}`}
              data-i={i}
              role="option"
              lang={o.lang}
              aria-selected={i === selectedIndex}
              aria-disabled={o.disabled || undefined}
              className={`sel-option${i === active ? ' is-active' : ''}${i === selectedIndex ? ' is-selected' : ''}`}
              onPointerMove={() => !o.disabled && active !== i && setActive(i)}
              onClick={() => !o.disabled && choose(i)}
            >
              <span>{o.label}</span>
              {i === selectedIndex && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>,
        // A modal dialog sits above everything else, so a list opened in one stays in it.
        triggerRef.current?.closest('dialog') ?? document.body,
      )}
    </>
  )
}

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'
import '../styles/dropdown.css'

export default function CustomDropdown({ label, value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
    if (!open) setSearch('')
  }, [open])

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selected = options.find(o => o.value === value)

  return (
    <div className="dropdown" ref={ref}>
      {label && <span className="dropdown-label">{label}</span>}
      <button
        className={`dropdown-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className={`dropdown-value ${!value ? 'placeholder' : ''}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={14} className={`dropdown-chevron ${open ? 'rotated' : ''}`} />
      </button>

      <div className={`dropdown-menu ${open ? 'visible' : ''}`}>
        <div className="dropdown-search">
          <Search size={13} className="dropdown-search-icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="dropdown-list">
          {filtered.length === 0 ? (
            <div className="dropdown-empty">No results</div>
          ) : (
            filtered.map(o => (
              <button
                key={o.value}
                className={`dropdown-option ${o.value === value ? 'selected' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false) }}
                type="button"
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={14} className="dropdown-check" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

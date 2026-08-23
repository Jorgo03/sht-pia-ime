import { useEffect, useState } from 'react'
import { User } from 'lucide-react'

// Reusable circular avatar: photo -> orange initial (name, then email) ->
// generic user icon. `imgError` mirrors the same broken-image pattern
// PropertyCard/FeaturedCard already use, reset whenever `src` changes so a
// swapped-in photo gets a fresh chance to load.
export default function Avatar({ src, name, email, size = 36, className = '' }) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => { setImgError(false) }, [src])

  const initial = (name?.trim()?.[0] || email?.trim()?.[0] || '').toUpperCase()

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--fho-orange-1),var(--fho-orange-2))] text-white ${className}`}
      style={{ width: size, height: size }}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : initial ? (
        <span className="font-sans font-bold" style={{ fontSize: Math.round(size * 0.4) }}>{initial}</span>
      ) : (
        <User size={Math.round(size * 0.55)} strokeWidth={1.8} />
      )}
    </div>
  )
}

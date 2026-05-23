import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import '../styles/lightbox.css'

export default function ImageLightbox({ images, index, onClose, onNavigate }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') onNavigate(-1)
    if (e.key === 'ArrowRight') onNavigate(1)
  }, [onClose, onNavigate])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>

      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <img src={images[index]} alt="" className="lightbox-img" />
      </div>

      {images.length > 1 && (
        <>
          <button
            className="lightbox-nav lightbox-prev"
            onClick={e => { e.stopPropagation(); onNavigate(-1) }}
            aria-label="Previous"
          ><ChevronLeft size={28} /></button>
          <button
            className="lightbox-nav lightbox-next"
            onClick={e => { e.stopPropagation(); onNavigate(1) }}
            aria-label="Next"
          ><ChevronRight size={28} /></button>
          <div className="lightbox-counter">{index + 1} / {images.length}</div>
        </>
      )}
    </div>
  )
}

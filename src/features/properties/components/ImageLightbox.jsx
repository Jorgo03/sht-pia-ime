import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSwipe } from '../../../hooks/useSwipe'

const navBtn =
  'absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30'

export default function ImageLightbox({ images, index, onClose, onNavigate }) {
  const { t } = useTranslation()
  const swipe = useSwipe({
    onSwipeLeft: () => onNavigate(1),
    onSwipeRight: () => onNavigate(-1),
  })
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
    <div
      className="fixed inset-0 z-[9999] flex animate-fho-fade items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
        onClick={onClose}
        aria-label={t('common.close')}
      >
        <X size={24} />
      </button>

      <div
        className="flex max-h-[85vh] max-w-[90vw] items-center justify-center"
        onClick={e => e.stopPropagation()}
        onPointerDown={images.length > 1 ? swipe.onPointerDown : undefined}
        onPointerUp={images.length > 1 ? swipe.onPointerUp : undefined}
        onPointerCancel={images.length > 1 ? swipe.onPointerCancel : undefined}
        style={images.length > 1 ? swipe.style : undefined}
      >
        <img src={images[index]} alt="" draggable={false} className="max-h-[85vh] max-w-full select-none rounded-lg object-contain" />
      </div>

      {images.length > 1 && (
        <>
          <button
            className={`${navBtn} left-4`}
            onClick={e => { e.stopPropagation(); onNavigate(-1) }}
            aria-label={t('common.previous')}
          ><ChevronLeft size={28} /></button>
          <button
            className={`${navBtn} right-4`}
            onClick={e => { e.stopPropagation(); onNavigate(1) }}
            aria-label={t('common.next')}
          ><ChevronRight size={28} /></button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-fho-lg bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}

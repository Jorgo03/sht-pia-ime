import '../styles/skeleton.css'

export default function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-img skeleton-pulse" />
      <div className="skeleton-price skeleton-pulse" />
      <div className="skeleton-loc skeleton-pulse" />
    </div>
  )
}

const pulse =
  'animate-fho-shimmer rounded-fho-sm bg-[linear-gradient(90deg,var(--fho-bg)_25%,var(--fho-border)_50%,var(--fho-bg)_75%)] bg-[length:200%_100%]'

export default function SkeletonCard() {
  return (
    <div className="rounded-fho-md border-[0.5px] border-fho-border bg-fho-surface p-2">
      <div className={`${pulse} mb-2 h-[90px]`} />
      <div className={`${pulse} mb-1.5 h-3.5 w-3/5`} />
      <div className={`${pulse} h-3 w-2/5`} />
    </div>
  )
}

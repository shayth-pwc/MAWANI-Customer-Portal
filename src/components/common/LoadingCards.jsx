function Skeleton({ className = '' }) {
  return <span className={`block animate-pulse rounded-full bg-[#f2f4f7] ${className}`} />
}

function LoadingCard() {
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-2.5 w-14" />
        </div>
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-2.5 w-14" />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="size-5 rounded-md" />
      </div>
    </article>
  )
}

export default function LoadingCards({ count = 6 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <LoadingCard key={index} />
      ))}
    </div>
  )
}

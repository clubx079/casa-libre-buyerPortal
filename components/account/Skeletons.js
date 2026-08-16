// Branded loading placeholders for the account screens.
export function CardSkeleton() {
  return (
    <div className="bg-card border border-ink/12 rounded-[18px] overflow-hidden animate-pulse">
      <div className="h-[150px] bg-ink/[0.06]" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-[18px] w-1/2 bg-ink/10 rounded" />
        <div className="h-3 w-2/3 bg-ink/[0.08] rounded" />
        <div className="h-3 w-1/3 bg-ink/[0.08] rounded" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ n = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: n }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

// Small inline pulse used for stat numbers while they load.
export function StatSkeleton() {
  return <span className="inline-block h-[30px] w-12 bg-ink/10 rounded animate-pulse align-middle" />;
}

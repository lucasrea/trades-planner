/** Deferred job body while clients, lines, and documents load. */
export function JobDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading job details">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="h-10 w-full rounded-xl bg-card sm:w-36" />
        <div className="h-10 w-full rounded-xl bg-card sm:w-36" />
        <div className="h-10 w-full rounded-xl bg-elevated sm:w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="card space-y-4 p-6">
          <div className="h-4 w-24 rounded bg-elevated" />
          <div className="h-10 rounded-lg bg-card" />
          <div className="h-10 rounded-lg bg-card" />
          <div className="h-24 rounded-lg bg-card" />
        </div>
        <div className="space-y-4">
          <div className="card h-28 rounded-2xl bg-card" />
          <div className="card h-40 rounded-2xl bg-card" />
        </div>
      </div>
      <section className="space-y-3">
        <div className="h-6 w-36 rounded bg-elevated" />
        <div className="h-4 max-w-xl rounded bg-card" />
        <div className="card space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 rounded-lg bg-elevated" />
          ))}
        </div>
      </section>
    </div>
  );
}
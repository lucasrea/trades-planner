import { PageHeader } from "@/components/app-shell";

export default function JobsLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading jobs">
      <PageHeader title="Jobs" subtitle="Active work and quoted jobs." />
      <div className="card overflow-hidden">
        <div className="grid grid-cols-6 gap-3 border-b border-line px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-3 rounded bg-elevated" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="grid grid-cols-6 gap-3 border-b border-line px-4 py-4 last:border-0">
            <div className="col-span-2 h-4 rounded bg-card" />
            <div className="h-4 rounded bg-card" />
            <div className="h-5 w-16 rounded-full bg-card" />
            <div className="h-4 rounded bg-card" />
            <div className="h-4 rounded bg-card" />
          </div>
        ))}
      </div>
    </div>
  );
}
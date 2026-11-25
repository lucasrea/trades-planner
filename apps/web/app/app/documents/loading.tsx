import { PageHeader } from "@/components/app-shell";

export default function DocumentsLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading documents">
      <PageHeader title="Documents" subtitle="Quotes and invoices in one list." />
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-9 w-24 rounded-full bg-card" />
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-5 gap-3 border-b border-line px-4 py-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-3 rounded bg-elevated" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-5 gap-3 border-b border-line px-4 py-4 last:border-0">
            <div className="h-4 rounded bg-card" />
            <div className="h-4 rounded bg-card" />
            <div className="h-5 w-14 rounded-full bg-card" />
            <div className="h-4 rounded bg-card" />
            <div className="h-4 rounded bg-card" />
          </div>
        ))}
      </div>
    </div>
  );
}
import { PageHeader } from "@/components/app-shell";

export default function DocumentDetailLoading() {
  return (
    <div className="max-w-5xl min-w-0 animate-pulse" aria-busy="true" aria-label="Loading document">
      <PageHeader title="Document" subtitle="Quote or invoice" back={{ href: "/app/documents", label: "Documents" }} />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-10 w-28 rounded-xl bg-card" />
        ))}
      </div>
      <div className="card mb-6 grid gap-4 p-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-16 rounded bg-elevated" />
            <div className="h-5 w-32 rounded bg-card" />
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-4 gap-3 border-b border-line px-4 py-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-3 rounded bg-elevated" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, row) => (
          <div key={row} className="grid grid-cols-4 gap-3 border-b border-line px-4 py-4 last:border-0">
            <div className="col-span-2 h-4 rounded bg-card" />
            <div className="h-4 rounded bg-card" />
            <div className="h-4 rounded bg-card" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-4 border-t border-line pt-4">
        <div className="h-5 w-20 rounded bg-elevated" />
        <div className="h-6 w-24 rounded bg-card" />
      </div>
    </div>
  );
}
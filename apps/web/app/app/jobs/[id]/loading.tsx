import { PageHeader } from "@/components/app-shell";

export default function JobDetailLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading job">
      <PageHeader title="Job" subtitle="Loading…" />
      <div className="card h-40 rounded-2xl bg-card" />
      <div className="card space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-10 rounded-lg bg-elevated" />
        ))}
      </div>
    </div>
  );
}
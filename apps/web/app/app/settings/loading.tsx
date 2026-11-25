import { PageHeader } from "@/components/app-shell";

export default function SettingsLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading settings">
      <PageHeader title="Settings" subtitle="This is what prints on quotes and invoices." />
      <div className="card max-w-2xl space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-28 rounded bg-elevated" />
            <div className="h-10 w-full rounded-lg bg-card" />
          </div>
        ))}
      </div>
    </div>
  );
}
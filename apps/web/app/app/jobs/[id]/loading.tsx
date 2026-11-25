import { PageHeader } from "@/components/app-shell";
import { JobDetailSkeleton } from "@/components/job-detail-skeleton";

export default function JobDetailLoading() {
  return (
    <div className="max-w-5xl space-y-6" aria-busy="true" aria-label="Loading job">
      <PageHeader title="Job" subtitle="Loading…" back={{ href: "/app/jobs", label: "Jobs" }} />
      <div className="animate-pulse space-y-2.5">
        <div className="h-[4.5rem] rounded-2xl bg-card" />
        <div className="h-12 rounded-xl bg-card" />
      </div>
      <JobDetailSkeleton />
    </div>
  );
}
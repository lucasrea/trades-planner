import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { CaptureBar } from "@/components/capture-bar";
import { JobDetailBody } from "@/components/job-detail-body";
import { JobDetailSkeleton } from "@/components/job-detail-skeleton";
import { ReceiptUpload } from "@/components/receipt-upload";
import { StatusBadge } from "@/components/status-badge";
import { actionErrorNotice } from "@/lib/action-errors";
import { getJob } from "@/lib/queries";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const notice = actionErrorNotice(Array.isArray(raw.error) ? raw.error[0] : raw.error);
  const job = await getJob(id);
  if (!job) notFound();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={job.title}
        subtitle={job.client?.name}
        back={{ href: "/app/jobs", label: "Jobs" }}
        action={<StatusBadge status={job.status} />}
      />
      {notice ? (
        <p className="text-sm text-danger" role="alert">
          {notice}
        </p>
      ) : null}
      <div className="space-y-2.5">
        <CaptureBar lockedJob={{ id: job.id, title: job.title, clientName: job.client?.name ?? null }} />
        <ReceiptUpload lockedJob={{ id: job.id, title: job.title, clientName: job.client?.name ?? null }} compact />
      </div>
      <Suspense fallback={<JobDetailSkeleton />}>
        <JobDetailBody job={job} />
      </Suspense>
    </div>
  );
}
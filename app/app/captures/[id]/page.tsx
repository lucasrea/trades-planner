import { notFound } from "next/navigation";
import { CaptureReviewForm } from "@/components/capture-review-form";
import { CaptureReview } from "@/components/capture-review";
import { actionErrorNotice } from "@/lib/action-errors";
import { parseDescribeExtraction, parseReceiptExtraction } from "@/lib/ai/extraction-types";
import { getContractor } from "@/lib/auth";
import { receiptToDraft } from "@/lib/line-items";
import { getCapture, getClients, getJobs } from "@/lib/queries";

export default async function CaptureReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const notice = actionErrorNotice(Array.isArray(raw.error) ? raw.error[0] : raw.error);
  const capture = await getCapture(id);
  if (!capture) notFound();
  const contractor = await getContractor();
  const [clients, jobs] = await Promise.all([getClients(), getJobs()]);

  const manualHref = capture.jobId ? `/app/jobs/${capture.jobId}` : "/app/jobs";

  if (capture.status === "failed") {
    return (
      <>
        {notice ? (
          <p className="mb-4 text-sm text-accent" role="alert">
            {notice}
          </p>
        ) : null}
        <CaptureReview
          capture={{
            id: capture.id,
            type: capture.type,
            status: capture.status,
            jobId: capture.jobId,
            transcript: capture.transcript,
            imagePath: capture.imagePath,
            extraction: capture.extraction,
            error: capture.error,
          }}
          manualHref={manualHref}
        />
      </>
    );
  }

  if (capture.status !== "needs_review") {
    return (
      <div className="card p-6 text-sm">
        <p>This capture is {capture.status}.</p>
        <a href="/app" className="btn btn-ghost btn-sm mt-4">
          Back to Home
        </a>
      </div>
    );
  }

  const describe = capture.type !== "receipt" ? parseDescribeExtraction(capture.extraction) : null;
  const receipt = capture.type === "receipt" ? parseReceiptExtraction(capture.extraction) : null;
  const receiptLines =
    receipt && capture.type === "receipt"
      ? receiptToDraft(receipt, { markupPct: contractor.defaultMarkupPct }).map((line) => ({
          ...line,
          jobId: capture.jobId ?? undefined,
        }))
      : undefined;

  return (
    <div>
      {notice ? (
        <p className="mb-4 text-sm text-accent" role="alert">
          {notice}
        </p>
      ) : null}
      <CaptureReviewForm
        captureId={capture.id}
        captureType={capture.type}
        extraction={describe}
        transcript={capture.transcript}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title, clientId: j.clientId }))}
        labourRate={contractor.labourRateHourly}
        taxRate={contractor.taxRate}
        taxLabel={contractor.taxLabel}
        defaultJobId={capture.jobId}
        initialLines={receiptLines}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { CaptureReviewForm } from "@/components/capture-review-form";
import { CaptureReview } from "@/components/capture-review";
import { actionErrorNotice } from "@/lib/action-errors";
import { parseDescribeExtraction, parseReceiptExtraction } from "@/lib/ai/extraction-types";
import { getContractor } from "@/lib/auth";
import { receiptToDraft, receiptWarnings } from "@/lib/line-items";
import { captureProcessingIsStale } from "@/lib/captures-display";
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

  if (capture.status === "processing") {
    // Request-time check (server component); not cached static render.
    const nowMs = Date.now(); // eslint-disable-line react-hooks/purity -- capture staleness at request time
    const stale = captureProcessingIsStale(capture.createdAt, nowMs);
    if (!stale) {
      return (
        <div className="card space-y-3 p-6 text-sm">
          <p>Reading your description…</p>
          <p className="text-muted">This usually takes a few seconds. Refresh if it stays here too long.</p>
          <a href={`/app/captures/${capture.id}`} className="btn btn-ghost btn-sm">
            Refresh
          </a>
        </div>
      );
    }
    return (
      <>
        <CaptureReview
          capture={{
            id: capture.id,
            type: capture.type,
            status: "failed",
            jobId: capture.jobId,
            transcript: capture.transcript,
            imagePath: capture.imagePath,
            extraction: capture.extraction,
            error: "This took too long. Add lines manually or try again.",
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
  const receiptWarningMessages = receipt ? receiptWarnings(receipt) : [];

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
        warningMessages={receiptWarningMessages}
      />
    </div>
  );
}

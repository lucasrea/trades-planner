import { notFound, redirect } from "next/navigation";
import { CaptureReviewForm } from "@/components/capture-review-form";
import { CaptureReview } from "@/components/capture-review";
import { ReceiptReviewForm } from "@/components/receipt-review-form";
import { actionErrorNotice } from "@/lib/action-errors";
import { parseDescribeExtraction, parseReceiptExtraction } from "@/lib/ai/extraction-types";
import { changeHref, parsePlanChange } from "@/lib/plan-changes";
import { getContractor } from "@/lib/auth";
import { receiptReviewLines } from "@/lib/line-items";
import { captureProcessingIsStale } from "@/lib/captures-display";
import { getCapture, getCaptureResultJobs, getClients, getJobs } from "@/lib/queries";
import { isActiveJobStatus } from "@/lib/status";
import { signedReceiptUrl } from "@/lib/storage/receipts";

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
  const planCard = capture.type === "receipt" ? null : parseDescribeExtraction(capture.extraction);
  if (planCard?.action === "change") {
    // A change card has nothing to review here; its document, job or page is where to look.
    const change = parsePlanChange(planCard.change);
    redirect(change ? changeHref(change) : "/app");
  }
  if (planCard?.action === "invoice_tracked") {
    // The lines are the job's tracked rows. Retyping them here would bill them twice.
    redirect(planCard.document_id ? `/app/documents/${planCard.document_id}` : planCard.job_id ? `/app/jobs/${planCard.job_id}` : "/app");
  }
  const contractor = await getContractor();
  const [clients, jobs] = await Promise.all([getClients(), getJobs()]);

  const manualHref = capture.jobId ? `/app/jobs/${capture.jobId}` : "/app/jobs";

  if (capture.status === "failed") {
    return (
      <>
        {notice ? (
          <p className="mb-4 text-sm text-danger" role="alert">
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
          <p>{capture.type === "receipt" ? "Reading your receipt…" : "Reading your description…"}</p>
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

  if (capture.status === "confirmed" && capture.type === "receipt") {
    const resultJobs = await getCaptureResultJobs(capture.id);
    return (
      <div className="card space-y-3 p-6 text-sm">
        <p className="font-medium">Receipt added to {resultJobs.length === 1 ? "1 job" : `${resultJobs.length} jobs`}.</p>
        <p className="text-muted">The items are saved as unbilled materials. No invoice was created.</p>
        <ul className="space-y-1">
          {resultJobs.map((job) => (
            <li key={job.id}>
              <a href={`/app/jobs/${job.id}`} className="text-accent underline">
                {job.title}
              </a>{" "}
              <span className="text-muted">({job.lineCount} {job.lineCount === 1 ? "item" : "items"})</span>
            </li>
          ))}
        </ul>
        <a href="/app" className="btn btn-ghost btn-sm">
          Back to Plan
        </a>
      </div>
    );
  }

  if (capture.status !== "needs_review") {
    return (
      <div className="card p-6 text-sm">
        <p>This capture is {capture.status}.</p>
        <a href="/app" className="btn btn-ghost btn-sm mt-4">
          Back to Plan
        </a>
      </div>
    );
  }

  if (capture.type === "receipt") {
    const receipt = parseReceiptExtraction(capture.extraction);
    const imageUrl = await signedReceiptUrl(contractor.id, capture.imagePath);
    const openJobs = jobs.filter((job) => isActiveJobStatus(job.status) || job.id === capture.jobId);
    const openJobIds = new Set(openJobs.map((job) => job.id));
    const reviewLines = receiptReviewLines(receipt, {
      markupPct: contractor.defaultMarkupPct,
      captureJobId: capture.jobId,
      openJobIds,
    });
    return (
      <div>
        {notice ? (
          <p className="mb-4 text-sm text-danger" role="alert">
            {notice}
          </p>
        ) : null}
        <ReceiptReviewForm
          captureId={capture.id}
          imageUrl={imageUrl}
          vendor={receipt?.vendor ?? null}
          purchasedAt={receipt?.purchased_at ?? null}
          note={capture.transcript}
          subtotal={receipt?.subtotal ?? null}
          lines={reviewLines}
          jobs={openJobs.map((job) => ({ id: job.id, title: job.title }))}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          markupPct={contractor.defaultMarkupPct}
        />
      </div>
    );
  }

  const describe = parseDescribeExtraction(capture.extraction);

  return (
    <div>
      {notice ? (
        <p className="mb-4 text-sm text-danger" role="alert">
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
      />
    </div>
  );
}

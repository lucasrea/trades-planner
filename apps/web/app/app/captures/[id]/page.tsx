import { notFound } from "next/navigation";
import { CaptureReviewForm } from "@/components/capture-review-form";
import { CaptureReview } from "@/components/capture-review";
import { ReceiptReviewForm } from "@/components/receipt-review-form";
import { actionErrorNotice } from "@/lib/action-errors";
import { parseDescribeExtraction, parseReceiptExtraction } from "@/lib/ai/extraction-types";
import { getContractor } from "@/lib/auth";
import { receiptToDraft, receiptWarnings } from "@/lib/line-items";
import { captureProcessingIsStale } from "@/lib/captures-display";
import { getCapture, getCaptureResultJobs, getClients, getJobs } from "@/lib/queries";
import { isActiveJobStatus } from "@/lib/status";
import {
  getReceiptStorage,
  receiptPathBelongsTo,
  RECEIPT_SIGNED_URL_TTL_SECONDS,
} from "@/lib/storage/receipts";

async function receiptImageUrl(contractorId: string, imagePath: string | null) {
  if (!imagePath || !receiptPathBelongsTo(imagePath, contractorId)) return null;
  try {
    return await getReceiptStorage().signedUrl(imagePath, RECEIPT_SIGNED_URL_TTL_SECONDS);
  } catch {
    return null;
  }
}

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
    const imageUrl = await receiptImageUrl(contractor.id, capture.imagePath);
    const openJobs = jobs.filter((job) => isActiveJobStatus(job.status) || job.id === capture.jobId);
    const openJobIds = new Set(openJobs.map((job) => job.id));
    const drafts = receipt ? receiptToDraft(receipt, { markupPct: contractor.defaultMarkupPct }) : [];
    return (
      <div>
        {notice ? (
          <p className="mb-4 text-sm text-accent" role="alert">
            {notice}
          </p>
        ) : null}
        <ReceiptReviewForm
          captureId={capture.id}
          imageUrl={imageUrl}
          vendor={receipt?.vendor ?? null}
          purchasedAt={receipt?.purchased_at ?? null}
          note={capture.transcript}
          warnings={receipt ? receiptWarnings(receipt) : []}
          lines={drafts.map((line, index) => {
            const jobId = receipt?.lines[index]?.jobId ?? capture.jobId;
            return {
              description: line.description,
              quantity: line.quantity,
              cost: line.unitCost ?? 0,
              jobId: jobId && openJobIds.has(jobId) ? jobId : null,
            };
          })}
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
      />
    </div>
  );
}

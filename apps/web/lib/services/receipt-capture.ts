import { and, desc, eq, inArray } from "drizzle-orm";
import { runReceiptExtraction } from "@/lib/ai/extract-receipt";
import type { ReceiptExtraction } from "@/lib/ai/extraction-types";
import type { ReceiptImageMime } from "@/lib/captures/image";
import type { Database } from "@/lib/db";
import { captures, jobs } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { matchJobInText } from "@/lib/line-items";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";
import { receiptImagePath, type ReceiptStorage } from "@/lib/storage/receipts";

export const RECEIPT_FAILED_MESSAGE = "We couldn't read that receipt. Try a clearer photo, or add the lines by hand on the job.";

export type ReceiptCaptureResult = {
  captureId: string;
  status: "needs_review" | "failed";
  reviewUrl: string;
};

export async function createReceiptCapture(
  db: Database,
  contractor: { id: string },
  input: {
    image: { bytes: Uint8Array; mimeType: ReceiptImageMime };
    /** Job picked in the UI or implied by the job page. Always wins over the note. */
    jobId?: string | null;
    /** Optional words sent with the photo, e.g. "add this to the kitchen". */
    note?: string | null;
    storage: ReceiptStorage;
  },
): Promise<ReceiptCaptureResult> {
  await assertCaptureRateLimit(db, contractor.id);
  if (input.jobId) await requireJob(db, contractor.id, input.jobId);

  const note = input.note?.trim() || null;
  let jobId = input.jobId ?? null;
  if (!jobId && note) {
    const openJobs = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(and(eq(jobs.contractorId, contractor.id), inArray(jobs.status, ["quoted", "active"])))
      .orderBy(desc(jobs.updatedAt))
      .limit(50);
    jobId = matchJobInText(note, openJobs);
  }

  const captureId = newId();
  await db.insert(captures).values({
    id: captureId,
    contractorId: contractor.id,
    jobId,
    type: "receipt",
    status: "processing",
    transcript: note,
    createdAt: Date.now(),
  });

  let status: "needs_review" | "failed" = "needs_review";
  let error: string | null = null;
  let extraction: ReceiptExtraction | null = null;
  let imagePath: string | null = null;
  let model: string | null = null;
  let latencyMs = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let promptVersion: string | null = null;

  try {
    const path = receiptImagePath(contractor.id, captureId);
    await input.storage.put({ path, bytes: input.image.bytes, mimeType: input.image.mimeType });
    imagePath = path;
    const result = await runReceiptExtraction({ imageBytes: input.image.bytes, mimeType: input.image.mimeType });
    if (!result.extraction.lines.length) throw new Error("no receipt lines");
    // Aim every line at the chosen job. The contractor can change each one on the preview.
    extraction = { ...result.extraction, lines: result.extraction.lines.map((line) => ({ ...line, jobId })) };
    model = result.model;
    latencyMs = result.latencyMs;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    promptVersion = result.promptVersion;
  } catch {
    status = "failed";
    error = RECEIPT_FAILED_MESSAGE;
  } finally {
    await db
      .update(captures)
      .set({ status, error, extraction, imagePath, model, latencyMs, inputTokens, outputTokens, promptVersion })
      .where(and(eq(captures.id, captureId), eq(captures.contractorId, contractor.id)));
  }

  return { captureId, status, reviewUrl: `/app/captures/${captureId}` };
}

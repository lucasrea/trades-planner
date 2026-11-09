import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { validateImageFile } from "@/lib/captures/image";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { jsonError } from "@/lib/http/json-error";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { assertPlanTarget, recordPlanTurn } from "@/lib/services/plans";
import { receiptMessageBody, receiptReplyBody } from "@/lib/plans";
import { createReceiptCapture } from "@/lib/services/receipt-capture";
import { getReceiptStorage, StorageError } from "@/lib/storage/receipts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_NOTE_LENGTH = 500;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (response) {
    return response as Response;
  }

  const session = await getSession();
  if (!session) return jsonError("unauthorized", "Sign in required.", 401);

  const db = await ensureDb();
  const [contractor] = await db.select().from(contractors).where(eq(contractors.id, session.contractorId)).limit(1);
  if (!contractor) return jsonError("unauthorized", "Sign in required.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("invalid", "Expected multipart form data.", 400);
  }

  const image = form.get("image");
  const validated = await validateImageFile(image instanceof File ? image : null);
  if (!validated.ok) return jsonError("invalid", validated.message, validated.status);

  const jobField = form.get("jobId");
  const jobId = typeof jobField === "string" && jobField.trim() ? jobField.trim() : undefined;
  const noteField = form.get("note");
  const note = typeof noteField === "string" ? noteField.trim() : "";
  if (note.length > MAX_NOTE_LENGTH) return jsonError("invalid", `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`, 400);

  const planField = form.get("planId");
  const planId = typeof planField === "string" && planField.trim() ? planField.trim() : undefined;
  const ctx = { db, contractorId: contractor.id };
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  try {
    const result = await createReceiptCapture(db, contractor, {
      image: { bytes: validated.bytes, mimeType: validated.mimeType },
      jobId,
      note: note || undefined,
      storage: getReceiptStorage(),
    });
    // The plan keeps a one-line note. The photo stays on the capture.
    const savedPlanId = planId
      ? await recordPlanTurn(ctx, {
          planId,
          userBody: receiptMessageBody(note),
          replyBody: receiptReplyBody(result.status),
          captureId: result.captureId,
        })
      : null;
    return Response.json({ ...result, planId: savedPlanId });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    if (error instanceof StorageError) return jsonError("storage_unavailable", "Receipt photos are not available right now.", 503);
    throw error;
  }
}

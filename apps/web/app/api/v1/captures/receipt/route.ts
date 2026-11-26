import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { validateImageFile } from "@/lib/captures/image";
import { readFormFields } from "@/lib/http/form-fields";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { assertPlanTarget, recordReceiptTurn } from "@/lib/services/plans";
import { createReceiptCapture } from "@/lib/services/receipt-capture";
import { getReceiptStorage, StorageError } from "@/lib/storage/receipts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_NOTE_LENGTH = 500;

export async function POST(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const captureOff = assertCaptureEnabled();
  if (captureOff) return captureOff;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("invalid", "Expected multipart form data.", 400);
  }

  const image = form.get("image");
  const validated = await validateImageFile(image instanceof File ? image : null);
  if (!validated.ok) return jsonError("invalid", validated.message, validated.status);

  const { jobId, planId, note = "" } = readFormFields(form, ["jobId", "planId", "note"]);
  if (note.length > MAX_NOTE_LENGTH) {
    return jsonError("invalid", `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`, 400);
  }

  const ctx = { db: auth.db, contractorId: auth.contractorId };
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  try {
    const result = await createReceiptCapture(auth.db, auth.contractor, {
      image: { bytes: validated.bytes, mimeType: validated.mimeType },
      jobId,
      note: note || undefined,
      storage: getReceiptStorage(),
    });
    const savedPlanId = await recordReceiptTurn(ctx, { planId, note, jobId, result });
    return Response.json({ captureId: result.captureId, status: result.status, planId: savedPlanId });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    if (error instanceof StorageError) {
      return jsonError("storage_unavailable", "Receipt photos are not available right now.", 503);
    }
    throw error;
  }
}

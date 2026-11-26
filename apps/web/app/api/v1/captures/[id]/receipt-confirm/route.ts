import { jsonError } from "@/lib/http/json-error";
import { planErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { confirmCaptureSchema } from "@/lib/services/capture-schemas";
import { confirmCapture } from "@/lib/services/captures";

export const runtime = "nodejs";

const bodySchema = confirmCaptureSchema.pick({ lines: true, newJobs: true });

/** Add a receipt's lines to the job picked for each. Receipts only ever become unbilled materials. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid", "Check the details and try again.", 400);

  const { id } = await params;
  try {
    const result = await confirmCapture(
      { db: auth.db, contractorId: auth.contractorId },
      { captureId: id, createAs: "log", ...parsed.data },
    );
    return Response.json(result);
  } catch (error) {
    return planErrorResponse(error);
  }
}

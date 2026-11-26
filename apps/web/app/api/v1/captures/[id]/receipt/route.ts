import { jsonError } from "@/lib/http/json-error";
import { serviceErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { getReceiptReview } from "@/lib/services/receipt-capture";

export const runtime = "nodejs";

/** A receipt waiting for review: its photo, lines, and the jobs and clients they can go to. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  try {
    return Response.json({ receipt: await getReceiptReview({ db: auth.db, contractorId: auth.contractorId }, id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

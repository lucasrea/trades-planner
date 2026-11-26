import { jsonError } from "@/lib/http/json-error";
import { serviceErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { createInvoiceFromTrackedLines } from "@/lib/services/documents";

export const runtime = "nodejs";

/** Invoices the job's unbilled tracked lines. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  try {
    const documentId = await createInvoiceFromTrackedLines({ db: auth.db, contractorId: auth.contractorId }, id);
    return Response.json({ documentId });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

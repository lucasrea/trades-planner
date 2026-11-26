import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import {
  getContractorProfile,
  getJobDocumentsForContractor,
  getJobForContractor,
  getTrackedLinesForContractor,
} from "@/lib/queries-v2";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  const job = await getJobForContractor(auth.db, auth.contractorId, id);
  if (!job) return jsonError("not_found", "Job not found.", 404);

  const [tracked, documents, contractor] = await Promise.all([
    getTrackedLinesForContractor(auth.db, auth.contractorId, id),
    getJobDocumentsForContractor(auth.db, auth.contractorId, id),
    getContractorProfile(auth.db, auth.contractorId),
  ]);

  return Response.json({
    tracked: tracked.map((line) => ({
      id: line.id,
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      billedDocumentId: line.billedDocumentId,
    })),
    documents: documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      number: doc.number,
      total: doc.total,
      dueDate: doc.dueDate,
      // An approved quote that has not been invoiced yet.
      canInvoice:
        doc.type === "quote" && doc.status === "approved" && !documents.some((row) => row.sourceQuoteId === doc.id),
    })),
    contractor,
  });
}
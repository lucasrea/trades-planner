import { documentActions, type DocStatus, type DocType } from "@/lib/documents";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { getDocumentForContractor, getJobDocumentsForContractor } from "@/lib/queries-v2";
import { getActiveLinkToken, isShareableStatus } from "@/lib/services/document-links";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  const document = await getDocumentForContractor(auth.db, auth.contractorId, id);
  if (!document) return jsonError("not_found", "Document not found.", 404);

  const ctx = { db: auth.db, contractorId: auth.contractorId };
  const [shareToken, jobDocuments] = await Promise.all([
    getActiveLinkToken(ctx, document.id),
    document.type === "quote" && document.status === "approved"
      ? getJobDocumentsForContractor(auth.db, auth.contractorId, document.jobId)
      : Promise.resolve([]),
  ]);

  return Response.json({
    document: {
      id: document.id,
      jobId: document.jobId,
      type: document.type,
      status: document.status,
      number: document.number,
      notes: document.notes,
      validUntil: document.validUntil,
      dueDate: document.dueDate,
      subtotal: document.subtotal,
      tax: document.tax,
      total: document.total,
      client: document.client ? { name: document.client.name, email: document.client.email } : null,
      job: document.job ? { id: document.job.id, title: document.job.title } : null,
      lines: document.lines.map((line) => ({
        id: line.id,
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      actions: documentActions({ type: document.type as DocType, status: document.status as DocStatus }),
      canShare: isShareableStatus(document.status) || shareToken !== null,
      invoiceId: jobDocuments.find((row) => row.sourceQuoteId === document.id)?.id ?? null,
    },
  });
}

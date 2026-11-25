import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { getDocumentsForContractor, type DocumentListFilter } from "@/lib/queries-v2";

export const runtime = "nodejs";

function readFilter(url: URL): DocumentListFilter {
  const filter: DocumentListFilter = {};
  const type = url.searchParams.get("type");
  if (type === "quote" || type === "invoice") filter.type = type;
  const status = url.searchParams.get("status");
  if (status) filter.status = status;
  return filter;
}

export async function GET(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;
  const page = await getDocumentsForContractor(auth.db, auth.contractorId, readFilter(url), cursor, limit);

  return Response.json({
    documents: page.items.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      number: doc.number,
      total: doc.total,
      dueDate: doc.dueDate,
      validUntil: doc.validUntil,
      updatedAt: doc.updatedAt,
      client: doc.client ? { name: doc.client.name } : null,
      job: doc.job ? { id: doc.job.id, title: doc.job.title } : null,
    })),
    nextCursor: page.nextCursor,
  });
}
import { jsonError } from "@/lib/http/json-error";
import { serviceErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { createDocumentLink } from "@/lib/services/document-links";

export const runtime = "nodejs";

/** Returns the public `/d/[token]` link, creating one if the document has none. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  try {
    const token = await createDocumentLink({ db: auth.db, contractorId: auth.contractorId }, id);
    // Same base as emailed links. Without AUTH_URL (local development) the request's own origin works.
    const base = (process.env.AUTH_URL || new URL(request.url).origin).replace(/\/$/, "");
    return Response.json({ url: `${base}/d/${token}` });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

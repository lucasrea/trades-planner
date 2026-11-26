import { z } from "zod";
import { jsonError } from "@/lib/http/json-error";
import { serviceErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { setDocumentStatus } from "@/lib/services/documents";

export const runtime = "nodejs";

const bodySchema = z.object({ status: z.enum(["sent", "approved", "declined", "paid"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid", "Unknown status.", 400);

  const { id } = await params;
  try {
    await setDocumentStatus({ db: auth.db, contractorId: auth.contractorId }, id, parsed.data.status);
  } catch (error) {
    return serviceErrorResponse(error);
  }
  return Response.json({ status: parsed.data.status });
}

import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { NotFoundError } from "@/lib/services/context";
import { planThreadPayload } from "@/lib/services/plan-thread-payload";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  const ctx = { db: auth.db, contractorId: auth.contractorId };
  try {
    const payload = await planThreadPayload(ctx, id);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }
}
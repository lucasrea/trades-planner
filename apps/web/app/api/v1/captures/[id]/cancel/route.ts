import { jsonError } from "@/lib/http/json-error";
import { planErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { cancelPlanProposal } from "@/lib/services/plan-proposals";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id } = await params;
  try {
    await cancelPlanProposal({ db: auth.db, contractorId: auth.contractorId }, id);
  } catch (error) {
    return planErrorResponse(error);
  }
  return Response.json({ ok: true });
}

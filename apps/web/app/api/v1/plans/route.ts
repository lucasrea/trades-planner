import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { listPlans } from "@/lib/services/plans";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const plans = await listPlans({ db: auth.db, contractorId: auth.contractorId });
  return Response.json({
    plans: plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      jobTitle: plan.jobTitle,
      updatedAt: plan.updatedAt,
    })),
  });
}
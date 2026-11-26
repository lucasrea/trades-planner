import { jsonError } from "@/lib/http/json-error";
import { planErrorResponse } from "@/lib/http/service-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { confirmPlanProposal } from "@/lib/services/plan-proposals";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id: captureId } = await ctx.params;
  const serviceCtx = { db: auth.db, contractorId: auth.contractorId };

  try {
    const result = await confirmPlanProposal(serviceCtx, captureId, { authUrl: process.env.AUTH_URL });
    if (result.kind === "done") return Response.json({ kind: "done", message: result.message, href: result.href });
    if (result.kind === "document") {
      return Response.json({ kind: "document", documentId: result.documentId });
    }
    if (result.kind === "job") {
      return Response.json({ kind: "job", jobId: result.jobId });
    }
    return Response.json({ kind: "log", jobIds: result.jobIds });
  } catch (error) {
    return planErrorResponse(error);
  }
}

import { ACTION_ERROR_MESSAGES, codeFromServiceError } from "@/lib/action-errors";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { confirmPlanProposal } from "@/lib/services/plan-proposals";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const { id: captureId } = await ctx.params;
  const serviceCtx = { db: auth.db, contractorId: auth.contractorId };

  try {
    const result = await confirmPlanProposal(serviceCtx, captureId);
    if (result.kind === "document") {
      return Response.json({ kind: "document", documentId: result.documentId });
    }
    if (result.kind === "job") {
      return Response.json({ kind: "job", jobId: result.jobId });
    }
    return Response.json({ kind: "log", jobIds: result.jobIds });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", ACTION_ERROR_MESSAGES["not-found"], 404);
    if (error instanceof ValidationError) {
      const code = codeFromServiceError(error);
      return jsonError(code, ACTION_ERROR_MESSAGES[code], 400);
    }
    if (error instanceof ConflictError) {
      const code = codeFromServiceError(error);
      return jsonError(code, ACTION_ERROR_MESSAGES[code], 409);
    }
    throw error;
  }
}

import { z } from "zod";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { assertPlanTarget, listRecentPlanHistory, planTurnResponse, recordAgentTurn } from "@/lib/services/plans";
import { runPlanAgent } from "@/lib/services/plan-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  jobId: z.string().min(1).optional(),
  planId: z.string().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const captureOff = assertCaptureEnabled();
  if (captureOff) return captureOff;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid", "Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid", "Text must be 1–4000 characters.", 400);

  const ctx = { db: auth.db, contractorId: auth.contractorId };
  const { planId } = parsed.data;
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  const history = await listRecentPlanHistory(ctx, planId);

  try {
    const result = await runPlanAgent(auth.db, auth.contractor, {
      text: parsed.data.text,
      jobId: parsed.data.jobId,
      history,
    });
    const savedPlanId = await recordAgentTurn(ctx, {
      planId,
      userBody: parsed.data.text,
      result,
      jobId: parsed.data.jobId,
    });
    const turn = planTurnResponse(result, savedPlanId);
    const cards = result.parts.flatMap((part) =>
      part.kind === "card" ? [{ captureId: part.captureId, title: part.body, preview: part.preview }] : [],
    );
    return Response.json({ ...turn, cards });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}
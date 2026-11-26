import { getTranscriptionProvider } from "@/lib/ai/fake";
import { validateAudioFile } from "@/lib/captures/audio";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { readFormFields } from "@/lib/http/form-fields";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { runVoicePlan } from "@/lib/services/plan-agent";
import {
  assertPlanTarget,
  listRecentPlanHistory,
  planCards,
  planTurnResponse,
  recordAgentTurn,
} from "@/lib/services/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await contractorFromBearer(request);
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const captureOff = assertCaptureEnabled();
  if (captureOff) return captureOff;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("invalid", "Expected multipart form data.", 400);
  }

  const audio = form.get("audio");
  const validated = await validateAudioFile(audio instanceof File ? audio : null);
  if (!validated.ok) return jsonError("invalid", validated.message, validated.status);

  const { jobId, planId } = readFormFields(form, ["jobId", "planId"]);
  const ctx = { db: auth.db, contractorId: auth.contractorId };
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  const history = await listRecentPlanHistory(ctx, planId);

  try {
    // Same agent as a typed message. The plan keeps the transcript only; the audio is never stored.
    const result = await runVoicePlan(auth.db, auth.contractor, {
      jobId,
      history,
      transcribe: () =>
        getTranscriptionProvider().transcribe({ audioBytes: validated.bytes, mimeType: validated.mimeType }),
    });
    const savedPlanId = await recordAgentTurn(ctx, {
      planId,
      userBody: result.transcript || "Voice message",
      result,
      jobId,
    });
    return Response.json({ ...planTurnResponse(result, savedPlanId), cards: planCards(result) });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

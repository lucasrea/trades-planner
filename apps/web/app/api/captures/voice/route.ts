import { eq } from "drizzle-orm";
import { getTranscriptionProvider } from "@/lib/ai/fake";
import { getSession } from "@/lib/auth";
import { validateAudioFile } from "@/lib/captures/audio";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { jsonError } from "@/lib/http/json-error";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { runVoicePlan } from "@/lib/services/plan-agent";
import { assertPlanTarget, listRecentPlanHistory, planTurnResponse, recordAgentTurn } from "@/lib/services/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (response) {
    return response as Response;
  }

  const session = await getSession();
  if (!session) return jsonError("unauthorized", "Sign in required.", 401);

  const db = await ensureDb();
  const [contractor] = await db.select().from(contractors).where(eq(contractors.id, session.contractorId)).limit(1);
  if (!contractor) return jsonError("unauthorized", "Sign in required.", 401);

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

  const jobField = form.get("jobId");
  const jobId = typeof jobField === "string" && jobField.trim() ? jobField.trim() : undefined;

  const planField = form.get("planId");
  const planId = typeof planField === "string" && planField.trim() ? planField.trim() : undefined;
  const ctx = { db, contractorId: contractor.id };
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  const audioBytes = validated.bytes;
  const mimeType = validated.mimeType;
  const history = await listRecentPlanHistory(ctx, planId);

  try {
    // Same agent as a typed message. The plan keeps the transcript only; the audio is never stored.
    const result = await runVoicePlan(db, contractor, {
      jobId,
      history,
      transcribe: () => getTranscriptionProvider().transcribe({ audioBytes, mimeType }),
    });
    const savedPlanId = await recordAgentTurn(ctx, {
      planId,
      userBody: result.transcript || "Voice message",
      result,
      jobId,
    });
    return json(planTurnResponse(result, savedPlanId));
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

import { z } from "zod";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { runPlanAgent } from "@/lib/services/plan-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  jobId: z.string().min(1).optional(),
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

  try {
    // Same agent as the web Plan screen, so the phone gets the same cards for the same words.
    const result = await runPlanAgent(auth.db, auth.contractor, { text: parsed.data.text, jobId: parsed.data.jobId });
    const cards = result.parts.flatMap((part) =>
      part.kind === "card" ? [{ captureId: part.captureId, title: part.body, preview: part.preview }] : [],
    );
    return Response.json({
      captureId: result.captureId,
      status: result.status,
      preview: result.preview,
      transcript: result.transcript,
      reply: result.reply ?? null,
      cards,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

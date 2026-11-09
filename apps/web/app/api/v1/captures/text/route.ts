import { z } from "zod";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { jsonError } from "@/lib/http/json-error";
import { contractorFromBearer } from "@/lib/mobile/bearer-auth";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { createDescribeCapture } from "@/lib/services/describe-capture";
import { requireJob } from "@/lib/services/internal";

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

  if (parsed.data.jobId) {
    try {
      await requireJob(auth.db, auth.contractorId, parsed.data.jobId);
    } catch (error) {
      if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
      throw error;
    }
  }

  try {
    const result = await createDescribeCapture(auth.db, auth.contractor, {
      type: "text",
      jobId: parsed.data.jobId,
      resolveTranscript: async () => parsed.data.text,
    });
    return Response.json({
      captureId: result.captureId,
      status: result.status,
      preview: result.preview,
      transcript: result.transcript,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

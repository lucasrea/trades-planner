import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { jsonError } from "@/lib/http/json-error";
import { textCaptureBodySchema } from "@/lib/services/capture-schemas";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { createDescribeCapture } from "@/lib/services/describe-capture";
import { assertPlanTarget, recordPlanTurn } from "@/lib/services/plans";
import { describeReplyBody } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function contractorForSession() {
  const session = await getSession();
  if (!session) return null;
  const db = await ensureDb();
  const [contractor] = await db.select().from(contractors).where(eq(contractors.id, session.contractorId)).limit(1);
  if (!contractor) return null;
  return { db, contractor };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (response) {
    return response as Response;
  }

  const auth = await contractorForSession();
  if (!auth) return jsonError("unauthorized", "Sign in required.", 401);

  const captureOff = assertCaptureEnabled();
  if (captureOff) return captureOff;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid", "Invalid JSON body.", 400);
  }

  const parsedBody = textCaptureBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("invalid", "Text must be 1–4000 characters.", 400);
  }

  const ctx = { db: auth.db, contractorId: auth.contractor.id };
  const { planId } = parsedBody.data;
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  try {
    const result = await createDescribeCapture(auth.db, auth.contractor, {
      type: "text",
      jobId: parsedBody.data.jobId,
      resolveTranscript: async () => parsedBody.data.text,
    });
    let savedPlanId: string | null = null;
    if (planId) {
      try {
        savedPlanId = await recordPlanTurn(ctx, {
          planId,
          userBody: parsedBody.data.text,
          replyBody: describeReplyBody({ status: result.status, previewTitle: result.preview?.title ?? null }),
          summaryTitle: result.preview?.title ?? null,
          jobTitle: result.preview?.jobTitle ?? null,
          jobId: parsedBody.data.jobId,
          captureId: result.captureId,
        });
      } catch {
        console.error({
          event: "plan_turn_failed",
          captureId: result.captureId,
          contractorId: auth.contractor.id,
        });
      }
    }
    return json({ ...result, planId: savedPlanId });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

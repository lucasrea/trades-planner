import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { jsonError } from "@/lib/http/json-error";
import { textCaptureBodySchema } from "@/lib/services/capture-schemas";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { createDescribeCapture } from "@/lib/services/describe-capture";

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

  try {
    const result = await createDescribeCapture(auth.db, auth.contractor, {
      type: "text",
      jobId: parsedBody.data.jobId,
      resolveTranscript: async () => parsedBody.data.text,
    });
    return json(result);
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

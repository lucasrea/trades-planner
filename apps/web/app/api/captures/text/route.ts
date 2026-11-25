import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";
import { assertCaptureEnabled } from "@/lib/captures/enabled";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { jsonError } from "@/lib/http/json-error";
import { textCaptureBodySchema } from "@/lib/services/capture-schemas";
import { NotFoundError, RateLimitError } from "@/lib/services/context";
import { encodePlanEvent } from "@/lib/http/plan-events";
import { assertPlanTarget, listRecentPlanHistory, recordPlanTurn } from "@/lib/services/plans";
import { runPlanAgent, type PlanAgentResult } from "@/lib/services/plan-agent";
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
  const message = parsedBody.data;
  const { planId } = message;
  try {
    await assertPlanTarget(ctx, planId);
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError("not_found", "Plan not found.", 404);
    throw error;
  }

  const history = await listRecentPlanHistory(ctx, planId);
  const wantsStream = (request.headers.get("accept") ?? "").includes("application/x-ndjson");

  async function save(result: PlanAgentResult) {
    const replies = result.parts.map((part) =>
      part.kind === "card" ? { body: part.body, captureId: part.captureId } : { body: part.body, captureId: null as string | null },
    );
    if (replies.length === 1 && !replies[0]?.captureId && result.captureId) replies[0]!.captureId = result.captureId;
    const first = replies[0] ?? {
      body: describeReplyBody({ status: result.status, previewTitle: result.preview?.title ?? null }),
      captureId: result.captureId || null,
    };
    let savedPlanId: string | null = null;
    if (planId) {
      try {
        const card = result.parts.find((part) => part.kind === "card");
        savedPlanId = await recordPlanTurn(ctx, {
          planId,
          userBody: message.text,
          replyBody: first.body,
          captureId: replies.length === 1 ? first.captureId : result.captureId || null,
          replies: replies.length > 1 ? replies : undefined,
          summaryTitle: result.reply ? null : (card?.body ?? result.preview?.title ?? null),
          jobTitle: result.jobTitle ?? result.preview?.jobTitle ?? null,
          jobId: message.jobId,
        });
      } catch {
        console.error({ event: "plan_turn_failed", captureId: result.captureId, contractorId: ctx.contractorId });
      }
    }
    return {
      captureId: result.captureId,
      status: result.status,
      reviewUrl: result.reviewUrl,
      preview: result.preview,
      transcript: result.transcript,
      reply: result.reply,
      jobTitle: result.jobTitle,
      planId: savedPlanId,
    };
  }

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (event: Parameters<typeof encodePlanEvent>[0]) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(encodePlanEvent(event)));
          } catch {
            closed = true;
          }
        };
        try {
          const result = await runPlanAgent(auth.db, auth.contractor, {
            text: message.text,
            jobId: message.jobId,
            history,
            onStatus: (text) => send({ type: "status", text }),
          });
          const saved = await save(result);
          send({ type: "done", planId: saved.planId, captureId: saved.captureId, reviewUrl: saved.reviewUrl, status: saved.status, reply: saved.reply });
        } catch (error) {
          if (error instanceof RateLimitError) send({ type: "error", status: 429, message: error.message });
          else if (error instanceof NotFoundError) send({ type: "error", status: 404, message: "Job not found." });
          else {
            console.error({ event: "plan_agent_failed", name: error instanceof Error ? error.name : "Error" });
            send({ type: "error", status: 500, message: "Couldn't send that. Your text is still here." });
          }
        } finally {
          closed = true;
          try {
            controller.close();
          } catch {
            /* The client already hung up. */
          }
        }
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  }

  try {
    const result = await runPlanAgent(auth.db, auth.contractor, {
      text: message.text,
      jobId: message.jobId,
      history,
    });
    return json(await save(result));
  } catch (error) {
    if (error instanceof RateLimitError) return jsonError("rate_limited", error.message, 429);
    if (error instanceof NotFoundError) return jsonError("not_found", "Job not found.", 404);
    throw error;
  }
}

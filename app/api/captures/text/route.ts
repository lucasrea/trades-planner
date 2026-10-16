import { and, desc, eq } from "drizzle-orm";
import { runDescribeExtraction } from "@/lib/ai/run-describe";
import { getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { captures, clients, contractors, jobs } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { newId } from "@/lib/id";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";

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
  if (!session) {
    return json({ error: { code: "unauthorized", message: "Sign in required." } }, 401);
  }

  const db = await ensureDb();
  const [contractor] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, session.contractorId))
    .limit(1);
  if (!contractor) {
    return json({ error: { code: "unauthorized", message: "Sign in required." } }, 401);
  }
  try {
    await assertCaptureRateLimit(db, contractor.id);
  } catch (response) {
    return response as Response;
  }

  let body: { text?: string; jobId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: "invalid", message: "Invalid JSON body." } }, 400);
  }

  const text = body.text?.trim() ?? "";
  if (text.length < 1 || text.length > 4000) {
    return json({ error: { code: "invalid", message: "Text must be 1–4000 characters." } }, 400);
  }

  if (body.jobId) {
    try {
      await requireJob(db, contractor.id, body.jobId);
    } catch {
      return json({ error: { code: "not_found", message: "Job not found." } }, 404);
    }
  }

  const captureId = newId();
  const now = Date.now();
  await db.insert(captures).values({
    id: captureId,
    contractorId: contractor.id,
    jobId: body.jobId ?? null,
    type: "text",
    status: "processing",
    transcript: text,
    createdAt: now,
  });

  const [clientRows, jobRows] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.contractorId, contractor.id)).orderBy(desc(clients.createdAt)).limit(50),
    db
      .select({ id: jobs.id, title: jobs.title, clientName: clients.name })
      .from(jobs)
      .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractor.id)))
      .where(eq(jobs.contractorId, contractor.id))
      .orderBy(desc(jobs.updatedAt))
      .limit(50),
  ]);

  let status: "needs_review" | "failed" = "needs_review";
  let error: string | null = null;
  let extraction: unknown = null;
  let model: string | null = null;
  let latencyMs = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let promptVersion: string | null = null;

  try {
    const result = await runDescribeExtraction({
      text,
      context: {
        labourRate: contractor.labourRateHourly,
        clients: clientRows,
        openJobs: jobRows.map((row) => ({ id: row.id, title: row.title, clientName: row.clientName ?? "" })),
      },
    });
    extraction = result.extraction;
    model = result.model;
    latencyMs = result.latencyMs;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    promptVersion = result.promptVersion;
  } catch (cause) {
    status = "failed";
    error = cause instanceof Error ? cause.message : "Extraction failed.";
  }

  await db
    .update(captures)
    .set({
      status,
      extraction,
      error,
      model,
      latencyMs,
      inputTokens,
      outputTokens,
      promptVersion,
    })
    .where(and(eq(captures.id, captureId), eq(captures.contractorId, contractor.id)));

  return json({
    captureId,
    status,
    reviewUrl: `/app/captures/${captureId}`,
  });
}

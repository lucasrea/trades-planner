import { and, desc, eq } from "drizzle-orm";
import { runDescribeExtraction } from "@/lib/ai/run-describe";
import type { Database } from "@/lib/db";
import { captures, clients, jobs } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";

export const EXTRACTION_FAILED_MESSAGE = "We couldn't read that. You can add lines manually on the review screen.";

export type DescribeCaptureResult = {
  captureId: string;
  status: "needs_review" | "failed";
  reviewUrl: string;
};

type ContractorSlice = { id: string; labourRateHourly: number };

export async function createDescribeCapture(
  db: Database,
  contractor: ContractorSlice,
  input: {
    type: "text" | "voice";
    jobId?: string | null;
    resolveTranscript: () => Promise<string>;
  },
): Promise<DescribeCaptureResult> {
  await assertCaptureRateLimit(db, contractor.id);
  if (input.jobId) {
    await requireJob(db, contractor.id, input.jobId);
  }

  const captureId = newId();
  await db.insert(captures).values({
    id: captureId,
    contractorId: contractor.id,
    jobId: input.jobId ?? null,
    type: input.type,
    status: "processing",
    transcript: null,
    createdAt: Date.now(),
  });

  let status: "needs_review" | "failed" = "needs_review";
  let error: string | null = null;
  let extraction: unknown = null;
  let model: string | null = null;
  let latencyMs = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let promptVersion: string | null = null;
  let transcript: string | null = null;

  try {
    transcript = (await input.resolveTranscript()).trim();
    if (!transcript) throw new Error("empty transcript");
    const [clientRows, jobRows] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.contractorId, contractor.id))
        .orderBy(desc(clients.createdAt))
        .limit(50),
      db
        .select({ id: jobs.id, title: jobs.title, clientName: clients.name })
        .from(jobs)
        .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractor.id)))
        .where(eq(jobs.contractorId, contractor.id))
        .orderBy(desc(jobs.updatedAt))
        .limit(50),
    ]);
    const result = await runDescribeExtraction({
      text: transcript,
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
  } catch {
    status = "failed";
    error = EXTRACTION_FAILED_MESSAGE;
  } finally {
    await db
      .update(captures)
      .set({
        status,
        transcript,
        extraction,
        error,
        model,
        latencyMs,
        inputTokens,
        outputTokens,
        promptVersion,
      })
      .where(and(eq(captures.id, captureId), eq(captures.contractorId, contractor.id)));
  }

  return {
    captureId,
    status,
    reviewUrl: `/app/captures/${captureId}`,
  };
}

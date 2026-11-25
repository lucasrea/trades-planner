import { and, desc, eq } from "drizzle-orm";
import { runDescribeExtraction } from "@/lib/ai/run-describe";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import type { Database } from "@/lib/db";
import { captures, clients, jobs } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { classifyPlanMessage, parseObviousAct } from "@/lib/plan-message";
import { buildProposal, type PlanPreview } from "@/lib/plan-proposal";
import { answerPlanQuestion, chatPlanReply } from "@/lib/services/plan-answers";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";
import { previewStoredProposal } from "@/lib/services/plan-proposals";

export const EXTRACTION_FAILED_MESSAGE = "We couldn't read that. You can add lines manually on the review screen.";

export type DescribeCaptureResult = {
  captureId: string;
  status: "needs_review" | "failed";
  reviewUrl: string;
  /** The Plan preview card. Null when the message failed or no action could be chosen. */
  preview: PlanPreview | null;
  transcript: string | null;
  /** A direct answer. Set when the message is a question or chat, and nothing is saved. */
  reply: string | null;
  jobTitle: string | null;
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
  const selectedJob = input.jobId ? await requireJob(db, contractor.id, input.jobId) : null;

  let transcriptRead = false;
  let transcriptText = "";
  let transcriptFailed = false;
  async function readTranscript() {
    if (!transcriptRead) {
      transcriptRead = true;
      try {
        transcriptText = (await input.resolveTranscript()).trim();
      } catch {
        transcriptFailed = true;
      }
    }
    if (transcriptFailed) throw new Error("transcript failed");
    return transcriptText;
  }

  let spoken = "";
  try {
    spoken = await readTranscript();
  } catch {
    spoken = "";
  }
  if (spoken && classifyPlanMessage(spoken) !== "act") {
    const answered =
      classifyPlanMessage(spoken) === "question"
        ? await answerPlanQuestion(db, contractor.id, spoken, selectedJob?.id)
        : chatPlanReply();
    await db.insert(captures).values({
      id: newId(),
      contractorId: contractor.id,
      jobId: input.jobId ?? null,
      type: input.type,
      status: "discarded",
      transcript: spoken,
      createdAt: Date.now(),
    });
    return {
      captureId: "",
      status: "needs_review",
      reviewUrl: "/app",
      preview: null,
      transcript: spoken,
      reply: answered.reply,
      jobTitle: answered.jobTitle,
    };
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
  let extraction: DescribeExtraction | null = null;
  let model: string | null = null;
  let latencyMs = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let promptVersion: string | null = null;
  let transcript: string | null = null;

  try {
    transcript = await readTranscript();
    if (!transcript) throw new Error("empty transcript");
    const [clientRows, jobRows] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.contractorId, contractor.id))
        .orderBy(desc(clients.createdAt))
        .limit(50),
      db
        .select({ id: jobs.id, title: jobs.title, clientId: jobs.clientId, clientName: clients.name })
        .from(jobs)
        .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractor.id)))
        .where(eq(jobs.contractorId, contractor.id))
        .orderBy(desc(jobs.updatedAt))
        .limit(50),
    ]);
    const proposalInput = {
      selectedJob: selectedJob ? { id: selectedJob.id, title: selectedJob.title, clientId: selectedJob.clientId } : null,
      jobs: jobRows.map((row) => ({ id: row.id, title: row.title, clientId: row.clientId })),
      clients: clientRows,
      transcript,
    };
    const obvious = parseObviousAct(transcript);
    if (obvious) {
      extraction = buildProposal({ extraction: obvious, ...proposalInput });
    } else {
      const result = await runDescribeExtraction({
        text: transcript,
        context: {
          labourRate: contractor.labourRateHourly,
          clients: clientRows,
          openJobs: jobRows.map((row) => ({ id: row.id, title: row.title, clientName: row.clientName ?? "" })),
        },
      });
      extraction = buildProposal({ extraction: result.extraction, ...proposalInput });
      model = result.model;
      latencyMs = result.latencyMs;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      promptVersion = result.promptVersion;
    }
  } catch (caught) {
    console.error({
      event: "describe_failed",
      name: caught instanceof Error ? caught.name : "Error",
    });
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

  let preview: PlanPreview | null = null;
  if (status === "needs_review" && extraction) {
    try {
      preview = await previewStoredProposal({ db, contractorId: contractor.id }, extraction, transcript);
    } catch {
      preview = null;
    }
  }

  return {
    captureId,
    status,
    reviewUrl: `/app/captures/${captureId}`,
    preview,
    transcript,
    reply: null,
    jobTitle: preview?.jobTitle ?? null,
  };
}

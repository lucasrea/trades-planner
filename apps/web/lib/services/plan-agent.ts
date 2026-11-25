import { and, desc, eq, isNull } from "drizzle-orm";
import { createFakePlanClient } from "@/lib/ai/fake-plan-client";
import { createLivePlanClient } from "@/lib/ai/plan-loop-live";
import { runPlanLoop, type PlanHistoryMessage, type PlanLoopClient, type PlanToolCall } from "@/lib/ai/plan-loop";
import { PLAN_LOOP_VERSION } from "@/lib/ai/prompts";
import { parseLookupArgs, parseProposeArgs, parseReplyArgs, proposeArgsProblem } from "@/lib/ai/plan-tools";
import type { Database } from "@/lib/db";
import { captures, clients, documents, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { asksForAllJobs, pickLookupJob, unbilledSummary } from "@/lib/plan-lookup";
import { addMoney, roundMoney } from "@/lib/money";
import { matchJobInText } from "@/lib/line-items";
import {
  asksToInvoiceTrackedWork,
  classifyPlanMessage,
  formatJobPaperwork,
  parseCompoundWork,
  parseObviousAct,
} from "@/lib/plan-message";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { buildProposal, type PlanClientRef, type PlanJobRef, type PlanPreview } from "@/lib/plan-proposal";
import { describeReplyBody } from "@/lib/plans";
import { answerPlanQuestion, chatPlanReply } from "@/lib/services/plan-answers";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";
import { previewStoredProposal } from "@/lib/services/plan-proposals";

export const EXTRACTION_FAILED_MESSAGE = "We couldn't read that. You can add lines manually on the review screen.";

const MAX_PROPOSES = 4;
/** How much of the plan's earlier messages may back a price on this card. */
const EVIDENCE_MESSAGES = 6;
const EVIDENCE_CHARS = 4000;

type CaptureType = "text" | "voice";

function loopFailureKind(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/schema|invalid_function|parameters/i.test(message)) return "schema";
  if (/abort|timeout/i.test(message) || (error instanceof Error && error.name === "PlanLoopTimeoutError")) return "timeout";
  if (/429|rate limit/i.test(message)) return "rate";
  if (/401|api key/i.test(message)) return "auth";
  return "unknown";
}

export type PlanAgentPart =
  | { kind: "card"; captureId: string; body: string; jobTitle: string | null; preview: PlanPreview | null }
  | { kind: "text"; body: string };

export type PlanAgentResult = {
  captureId: string;
  status: "needs_review" | "failed";
  reviewUrl: string;
  preview: PlanPreview | null;
  transcript: string | null;
  reply: string | null;
  jobTitle: string | null;
  parts: PlanAgentPart[];
};

type ContractorSlice = { id: string; labourRateHourly: number };

function planClient(): { client: PlanLoopClient; model: string } {
  const provider = process.env.AI_PROVIDER ?? (process.env.NODE_ENV === "production" ? "live" : "fake");
  if (provider === "live") {
    const live = createLivePlanClient();
    return { client: live, model: live.model };
  }
  return { client: createFakePlanClient(), model: "fake" };
}

function resultFrom(parts: PlanAgentPart[], transcript: string, status: "needs_review" | "failed"): PlanAgentResult {
  const card = parts.find((part): part is Extract<PlanAgentPart, { kind: "card" }> => part.kind === "card");
  const text = parts.find((part): part is Extract<PlanAgentPart, { kind: "text" }> => part.kind === "text");
  return {
    captureId: card?.captureId ?? "",
    status,
    reviewUrl: card ? `/app/captures/${card.captureId}` : "/app",
    preview: null,
    transcript,
    reply: card ? null : (text?.body ?? null),
    jobTitle: card?.jobTitle ?? null,
    parts,
  };
}

export async function runPlanAgent(
  db: Database,
  contractor: ContractorSlice,
  input: {
    text: string;
    jobId?: string | null;
    history?: PlanHistoryMessage[];
    onStatus?: (text: string) => void;
    client?: PlanLoopClient;
    /** "voice" when the text is a transcript. Every capture this message writes gets that type. */
    captureType?: CaptureType;
  },
): Promise<PlanAgentResult> {
  await assertCaptureRateLimit(db, contractor.id);
  const selected = input.jobId ? await requireJob(db, contractor.id, input.jobId) : null;
  const transcript = input.text.trim();
  const status = input.onStatus ?? (() => undefined);
  const type: CaptureType = input.captureType ?? "text";
  const evidence =
    (input.history ?? [])
      .filter((entry) => entry.role === "user")
      .slice(-EVIDENCE_MESSAGES)
      .map((entry) => entry.content.trim())
      .join("\n")
      .slice(-EVIDENCE_CHARS) || null;

  if (!transcript) {
    return resultFrom([{ kind: "text", body: describeReplyBody({ status: "failed", previewTitle: null }) }], transcript, "failed");
  }

  const kind = classifyPlanMessage(transcript);
  if (kind === "question") {
    status(/\bunbilled\b/i.test(transcript) ? "Checking unbilled work" : "Checking quotes and invoices");
    const answered = await answerPlanQuestion(db, contractor.id, transcript, selected?.id, contractor.labourRateHourly);
    await remember(db, contractor.id, input.jobId, transcript, "discarded", type);
    return { ...resultFrom([{ kind: "text", body: answered.reply }], transcript, "needs_review"), jobTitle: answered.jobTitle };
  }
  if (kind === "chat") {
    status("Writing a reply");
    await remember(db, contractor.id, input.jobId, transcript, "discarded", type);
    return resultFrom([{ kind: "text", body: chatPlanReply().reply }], transcript, "needs_review");
  }

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
  const jobRefs: PlanJobRef[] = jobRows.map((row) => ({ id: row.id, title: row.title, clientId: row.clientId }));
  const clientRefs: PlanClientRef[] = clientRows;

  async function draftExtractions(extractions: NonNullable<ReturnType<typeof parseCompoundWork>>) {
    if (extractions.length === 0) return null;
    const cards = [];
    for (const extraction of extractions) {
      status(extraction.lines[0]?.kind === "labour" ? "Drafting the hours" : "Drafting the materials");
      const card = await storeProposal(db, contractor, {
        transcript,
        jobId: input.jobId,
        selected,
        extraction,
        trustJobTitle: false,
        model: null,
        jobs: jobRefs,
        clients: clientRefs,
        type,
        evidence,
      });
      if (card) cards.push(card);
    }
    const first = cards[0];
    if (!first) return null;
    return {
      ...resultFrom(cards.map((card) => card.part), transcript, "needs_review"),
      preview: first.preview,
      jobTitle: first.part.jobTitle,
    };
  }

  if (asksToInvoiceTrackedWork(transcript)) {
    // A job named in the words wins over the one that happens to be open, as it does for lookups.
    const jobId = matchJobInText(transcript, jobRefs) ?? selected?.id ?? null;
    const job = jobRefs.find((ref) => ref.id === jobId) ?? null;
    if (job) {
      status("Checking unbilled work");
      const [unbilled] = await db
        .select({ id: lineItems.id })
        .from(lineItems)
        .where(
          and(
            eq(lineItems.contractorId, contractor.id),
            eq(lineItems.jobId, job.id),
            isNull(lineItems.documentId),
            isNull(lineItems.billedDocumentId),
          ),
        )
        .limit(1);
      if (!unbilled) {
        await remember(db, contractor.id, input.jobId, transcript, "discarded", type);
        return {
          ...resultFrom([{ kind: "text", body: `${job.title} has no unbilled work to invoice.` }], transcript, "needs_review"),
          jobTitle: job.title,
        };
      }
      const card = await storeProposal(db, contractor, {
        transcript,
        jobId: input.jobId,
        selected,
        proposal: {
          intent: "invoice",
          client_name: null,
          job_title: job.title,
          site_address: null,
          scope_notes: null,
          lines: [],
          warnings: [],
          action: "invoice_tracked",
          job_id: job.id,
          client_id: job.clientId,
        },
        trustJobTitle: true,
        model: null,
        type,
        evidence: null,
      });
      if (card) return { ...resultFrom([card.part], transcript, "needs_review"), preview: card.preview, jobTitle: card.part.jobTitle };
    }
  }

  const compound = parseCompoundWork(transcript);
  if (compound) {
    const drafted = await draftExtractions(compound);
    if (drafted) return drafted;
  }

  const obvious = parseObviousAct(transcript);
  if (obvious) {
    status(obvious.lines[0]?.kind === "labour" ? "Drafting the hours" : "Drafting the materials");
    const card = await storeProposal(db, contractor, {
      transcript,
      jobId: input.jobId,
      selected,
      extraction: obvious,
      trustJobTitle: false,
      model: null,
      jobs: jobRefs,
      clients: clientRefs,
      type,
      evidence,
    });
    return card
      ? { ...resultFrom([card.part], transcript, "needs_review"), preview: card.preview, jobTitle: card.part.jobTitle }
      : await failed(db, contractor.id, input.jobId, transcript, type);
  }

  const chosen = input.client ? { client: input.client, model: "fake" } : planClient();
  const { client, model } = chosen;
  const parts: PlanAgentPart[] = [];
  let preview: PlanPreview | null = null;
  let proposes = 0;
  const started = Date.now();

  async function execute(call: PlanToolCall) {
    if (call.name === "reply") {
      const text = parseReplyArgs(call.arguments);
      if (!text) return JSON.stringify({ error: "Reply text is missing." });
      parts.push({ kind: "text", body: text });
      return JSON.stringify({ sent: true });
    }
    if (call.name === "lookup") {
      const args = parseLookupArgs(call.arguments);
      if (!args) return JSON.stringify({ error: "Could not read that lookup." });
      return lookup(db, contractor, args, selected?.id ?? null, transcript, jobRows);
    }
    if (call.name === "propose") {
      if (proposes >= MAX_PROPOSES) return JSON.stringify({ drafted: false, reason: "That's enough for this message." });
      const args = parseProposeArgs(call.arguments);
      if (!args) {
        return JSON.stringify({ drafted: false, reason: `Could not read that proposal. ${proposeArgsProblem(call.arguments)}`.trim() });
      }
      proposes += 1;
      const card = await storeProposal(db, contractor, {
        transcript,
        jobId: input.jobId,
        selected,
        extraction: {
          intent: args.intent ?? "log",
          client_name: args.client_name ?? null,
          job_title: args.job_title ?? null,
          site_address: args.site_address ?? null,
          scope_notes: args.notes ?? null,
          warnings: [],
          lines: args.lines.map((line) => ({
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unit_cost: line.unit_cost ?? null,
            unit_price:
              line.unit_cost != null && line.markup_amount != null
                ? addMoney(line.unit_cost, line.markup_amount)
                : (line.unit_price ?? null),
          })),
        },
        trustJobTitle: Boolean(args.job_title),
        model,
        latencyMs: Date.now() - started,
        jobs: jobRefs,
        clients: clientRefs,
        type,
        evidence,
      });
      if (!card) return JSON.stringify({ drafted: false, reason: "Nothing to propose from that." });
      if (!preview) preview = card.preview;
      parts.push(card.part);
      return JSON.stringify({ drafted: true, title: card.part.body, job: card.part.jobTitle });
    }
    return JSON.stringify({ error: "Unknown tool." });
  }

  const jobList = jobRows.map((row) => (row.clientName ? `${row.title} (${row.clientName})` : row.title)).join("; ") || "(none)";
  const contextNote = [
    selected ? `Open job: ${selected.title}` : "Open job: none",
    `Labour rate CAD/hr: ${contractor.labourRateHourly}`,
    `Jobs: ${jobList}`,
  ].join("\n");

  try {
    await runPlanLoop({ client, contextNote, userText: transcript, history: input.history, execute, onStatus: status });
  } catch (caught) {
    console.error({
      event: "plan_loop_failed",
      name: caught instanceof Error ? caught.name : "Error",
      kind: loopFailureKind(caught),
    });
    if (parts.length === 0) {
      const drafted = await draftExtractions(parseCompoundWork(transcript) ?? []);
      if (drafted) return drafted;
      return failed(db, contractor.id, input.jobId, transcript, type);
    }
    parts.push({ kind: "text", body: "I couldn't finish the rest of that." });
  }

  if (parts.length === 0) {
    const drafted = await draftExtractions(parseCompoundWork(transcript) ?? []);
    if (drafted) return drafted;
    return failed(db, contractor.id, input.jobId, transcript, type);
  }
  const built = resultFrom(parts, transcript, "needs_review");
  return { ...built, preview };
}

async function remember(
  db: Database,
  contractorId: string,
  jobId: string | null | undefined,
  transcript: string,
  captureStatus: "discarded" | "failed",
  type: CaptureType,
) {
  await db.insert(captures).values({
    id: newId(),
    contractorId,
    jobId: jobId ?? null,
    type,
    status: captureStatus,
    transcript,
    error: captureStatus === "failed" ? EXTRACTION_FAILED_MESSAGE : null,
    createdAt: Date.now(),
  });
}

async function failed(
  db: Database,
  contractorId: string,
  jobId: string | null | undefined,
  transcript: string | null,
  type: CaptureType,
): Promise<PlanAgentResult> {
  const captureId = newId();
  await db.insert(captures).values({
    id: captureId,
    contractorId,
    jobId: jobId ?? null,
    type,
    status: "failed",
    transcript,
    error: EXTRACTION_FAILED_MESSAGE,
    createdAt: Date.now(),
  });
  return {
    ...resultFrom([{ kind: "text", body: describeReplyBody({ status: "failed", previewTitle: null }) }], transcript ?? "", "failed"),
    transcript,
    captureId,
    reviewUrl: `/app/captures/${captureId}`,
    reply: null,
  };
}

async function storeProposal(
  db: Database,
  contractor: ContractorSlice,
  input: {
    transcript: string;
    jobId?: string | null;
    selected: { id: string; title: string; clientId: string } | null;
    /** What the model or a parser read. Turned into a proposal here. */
    extraction?: Parameters<typeof buildProposal>[0]["extraction"];
    /** A proposal already decided by app code. Stored as is. */
    proposal?: DescribeExtraction;
    trustJobTitle: boolean;
    model: string | null;
    latencyMs?: number;
    jobs?: PlanJobRef[];
    clients?: PlanClientRef[];
    type: CaptureType;
    evidence: string | null;
  },
) {
  const jobRefs = input.jobs ?? (input.selected ? [{ id: input.selected.id, title: input.selected.title, clientId: input.selected.clientId }] : []);
  const built =
    input.proposal ??
    (input.extraction
      ? buildProposal({
          extraction: input.extraction,
          selectedJob: input.selected,
          jobs: jobRefs,
          clients: input.clients ?? [],
          transcript: input.transcript,
          trustJobTitle: input.trustJobTitle,
        })
      : null);
  if (!built?.action) return null;
  const proposal: DescribeExtraction = input.evidence ? { ...built, evidence: input.evidence } : built;
  const ctx = { db, contractorId: contractor.id };
  let preview: PlanPreview | null = null;
  try {
    preview = await previewStoredProposal(ctx, proposal, input.transcript);
  } catch {
    preview = null;
  }
  const captureId = newId();
  await db.insert(captures).values({
    id: captureId,
    contractorId: contractor.id,
    jobId: proposal.job_id ?? input.jobId ?? null,
    type: input.type,
    status: "needs_review",
    transcript: input.transcript,
    extraction: proposal,
    model: input.model,
    latencyMs: input.latencyMs ?? 0,
    promptVersion: input.model ? PLAN_LOOP_VERSION : null,
    createdAt: Date.now(),
  });
  return {
    preview,
    part: {
      kind: "card" as const,
      captureId,
      body: preview?.title ?? describeReplyBody({ status: "needs_review", previewTitle: null }),
      jobTitle: preview?.jobTitle ?? proposal.job_title ?? null,
      preview,
    },
  };
}

async function lookup(
  db: Database,
  contractor: ContractorSlice,
  args: { what: "jobs" | "paperwork" | "unbilled"; job?: string | null },
  selectedJobId: string | null,
  transcript: string,
  jobRows: { id: string; title: string; clientName: string | null }[],
) {
  const contractorId = contractor.id;
  if (args.what === "jobs") {
    return JSON.stringify({
      jobs: jobRows.map((row) => ({ title: row.title, client: row.clientName })),
    });
  }
  const matchedId = pickLookupJob(jobRows, args.job, selectedJobId, transcript);
  const job = jobRows.find((row) => row.id === matchedId) ?? null;
  if (args.what === "unbilled" && !job && (!args.job || asksForAllJobs(args.job) || /^all$/i.test(args.job.trim()))) {
    const rows = await db
      .select({
        id: lineItems.id,
        jobId: lineItems.jobId,
        kind: lineItems.kind,
        description: lineItems.description,
        quantity: lineItems.quantity,
        unit: lineItems.unit,
        unitPrice: lineItems.unitPrice,
      })
      .from(lineItems)
      .where(
        and(
          eq(lineItems.contractorId, contractorId),
          isNull(lineItems.documentId),
          isNull(lineItems.billedDocumentId),
        ),
      );
    const byJob = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = byJob.get(row.jobId);
      if (bucket) bucket.push(row);
      else byJob.set(row.jobId, [row]);
    }
    const perJob = jobRows
      .map((row) => {
        const summary = unbilledSummary(byJob.get(row.id) ?? [], contractor.labourRateHourly);
        return { job: row.title, client: row.clientName, ...summary };
      })
      .filter((entry) => entry.lines.length > 0);
    const total = roundMoney(perJob.reduce((sum, entry) => sum + entry.total, 0));
    return JSON.stringify({ scope: "all", total, jobs: perJob });
  }
  if (!job) {
    return JSON.stringify({
      job: null,
      message: formatJobPaperwork({ jobTitle: null, jobNames: jobRows.map((row) => row.title), documents: [] }),
    });
  }
  if (args.what === "paperwork") {
    const docs = await db
      .select({ type: documents.type, number: documents.number, status: documents.status })
      .from(documents)
      .where(and(eq(documents.contractorId, contractorId), eq(documents.jobId, job.id)))
      .orderBy(desc(documents.updatedAt));
    return JSON.stringify({
      job: job.title,
      message: formatJobPaperwork({ jobTitle: job.title, jobNames: [], documents: docs }),
    });
  }
  const rows = await db
    .select({
      id: lineItems.id,
      kind: lineItems.kind,
      description: lineItems.description,
      quantity: lineItems.quantity,
      unit: lineItems.unit,
      unitPrice: lineItems.unitPrice,
    })
    .from(lineItems)
    .where(
      and(
        eq(lineItems.contractorId, contractorId),
        eq(lineItems.jobId, job.id),
        isNull(lineItems.documentId),
        isNull(lineItems.billedDocumentId),
      ),
    );
  const summary = unbilledSummary(rows, contractor.labourRateHourly);
  return JSON.stringify({ job: job.title, ...summary });
}

/**
 * A voice message: transcribe it, then treat the words exactly like a typed message, so the same
 * sentence gets the same cards whether it was said or typed. The audio is never stored.
 */
export async function runVoicePlan(
  db: Database,
  contractor: ContractorSlice,
  input: {
    transcribe: () => Promise<string>;
    jobId?: string | null;
    history?: PlanHistoryMessage[];
    onStatus?: (text: string) => void;
    client?: PlanLoopClient;
  },
): Promise<PlanAgentResult> {
  // Checked before paying for a transcript.
  await assertCaptureRateLimit(db, contractor.id);
  if (input.jobId) await requireJob(db, contractor.id, input.jobId);
  input.onStatus?.("Listening to your message");
  let transcript = "";
  try {
    transcript = (await input.transcribe()).trim();
  } catch (caught) {
    console.error({ event: "transcribe_failed", name: caught instanceof Error ? caught.name : "Error" });
  }
  if (!transcript) return failed(db, contractor.id, input.jobId, null, "voice");
  return runPlanAgent(db, contractor, { ...input, text: transcript, captureType: "voice" });
}

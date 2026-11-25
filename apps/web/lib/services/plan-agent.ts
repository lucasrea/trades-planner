import { and, desc, eq, isNull } from "drizzle-orm";
import { createFakePlanClient } from "@/lib/ai/fake-plan-client";
import { createLivePlanClient } from "@/lib/ai/plan-loop-live";
import { runPlanLoop, type PlanLoopClient, type PlanToolCall } from "@/lib/ai/plan-loop";
import { PLAN_LOOP_VERSION } from "@/lib/ai/prompts";
import { parseLookupArgs, parseProposeArgs, parseReplyArgs } from "@/lib/ai/plan-tools";
import type { Database } from "@/lib/db";
import { captures, clients, documents, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { pickLookupJob, unbilledSummary } from "@/lib/plan-lookup";
import { addMoney } from "@/lib/money";
import { classifyPlanMessage, formatJobPaperwork, parseCompoundWork, parseObviousAct } from "@/lib/plan-message";
import { buildProposal, type PlanClientRef, type PlanJobRef, type PlanPreview } from "@/lib/plan-proposal";
import { describeReplyBody } from "@/lib/plans";
import { answerPlanQuestion, chatPlanReply } from "@/lib/services/plan-answers";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";
import { previewStoredProposal } from "@/lib/services/plan-proposals";
import { EXTRACTION_FAILED_MESSAGE } from "@/lib/services/describe-capture";

const MAX_PROPOSES = 4;

function loopFailureKind(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/schema|invalid_function|parameters/i.test(message)) return "schema";
  if (/abort|timeout/i.test(message)) return "timeout";
  if (/429|rate limit/i.test(message)) return "rate";
  if (/401|api key/i.test(message)) return "auth";
  return "unknown";
}

export type PlanAgentPart =
  | { kind: "card"; captureId: string; body: string; jobTitle: string | null }
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
  input: { text: string; jobId?: string | null; onStatus?: (text: string) => void; client?: PlanLoopClient },
): Promise<PlanAgentResult> {
  await assertCaptureRateLimit(db, contractor.id);
  const selected = input.jobId ? await requireJob(db, contractor.id, input.jobId) : null;
  const transcript = input.text.trim();
  const status = input.onStatus ?? (() => undefined);

  if (!transcript) {
    return resultFrom([{ kind: "text", body: describeReplyBody({ status: "failed", previewTitle: null }) }], transcript, "failed");
  }

  const kind = classifyPlanMessage(transcript);
  if (kind === "question") {
    status("Checking quotes and invoices");
    const answered = await answerPlanQuestion(db, contractor.id, transcript, selected?.id);
    await remember(db, contractor.id, input.jobId, transcript, "discarded");
    return { ...resultFrom([{ kind: "text", body: answered.reply }], transcript, "needs_review"), jobTitle: answered.jobTitle };
  }
  if (kind === "chat") {
    status("Writing a reply");
    await remember(db, contractor.id, input.jobId, transcript, "discarded");
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
    });
    return card
      ? { ...resultFrom([card.part], transcript, "needs_review"), preview: card.preview, jobTitle: card.part.jobTitle }
      : await failed(db, contractor.id, input.jobId, transcript);
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
      if (!args) return JSON.stringify({ drafted: false, reason: "Could not read that proposal." });
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
    await runPlanLoop({ client, contextNote, userText: transcript, execute, onStatus: status });
  } catch (caught) {
    console.error({
      event: "plan_loop_failed",
      name: caught instanceof Error ? caught.name : "Error",
      kind: loopFailureKind(caught),
    });
    if (parts.length === 0) {
      const drafted = await draftExtractions(parseCompoundWork(transcript) ?? []);
      if (drafted) return drafted;
      return failed(db, contractor.id, input.jobId, transcript);
    }
    parts.push({ kind: "text", body: "I couldn't finish the rest of that." });
  }

  if (parts.length === 0) {
    const drafted = await draftExtractions(parseCompoundWork(transcript) ?? []);
    if (drafted) return drafted;
    return failed(db, contractor.id, input.jobId, transcript);
  }
  const built = resultFrom(parts, transcript, "needs_review");
  return { ...built, preview };
}

async function remember(db: Database, contractorId: string, jobId: string | null | undefined, transcript: string, captureStatus: "discarded" | "failed") {
  await db.insert(captures).values({
    id: newId(),
    contractorId,
    jobId: jobId ?? null,
    type: "text",
    status: captureStatus,
    transcript,
    error: captureStatus === "failed" ? EXTRACTION_FAILED_MESSAGE : null,
    createdAt: Date.now(),
  });
}

async function failed(db: Database, contractorId: string, jobId: string | null | undefined, transcript: string): Promise<PlanAgentResult> {
  const captureId = newId();
  await db.insert(captures).values({
    id: captureId,
    contractorId,
    jobId: jobId ?? null,
    type: "text",
    status: "failed",
    transcript,
    error: EXTRACTION_FAILED_MESSAGE,
    createdAt: Date.now(),
  });
  return {
    ...resultFrom([{ kind: "text", body: describeReplyBody({ status: "failed", previewTitle: null }) }], transcript, "failed"),
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
    extraction: Parameters<typeof buildProposal>[0]["extraction"];
    trustJobTitle: boolean;
    model: string | null;
    latencyMs?: number;
    jobs?: PlanJobRef[];
    clients?: PlanClientRef[];
  },
) {
  const jobRefs = input.jobs ?? (input.selected ? [{ id: input.selected.id, title: input.selected.title, clientId: input.selected.clientId }] : []);
  const proposal = buildProposal({
    extraction: input.extraction,
    selectedJob: input.selected,
    jobs: jobRefs,
    clients: input.clients ?? [],
    transcript: input.transcript,
    trustJobTitle: input.trustJobTitle,
  });
  if (!proposal.action) return null;
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
    type: "text",
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

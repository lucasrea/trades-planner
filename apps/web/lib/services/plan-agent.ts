import { and, desc, eq, isNull } from "drizzle-orm";
import { createFakePlanClient } from "@/lib/ai/fake-plan-client";
import { createLivePlanClient } from "@/lib/ai/plan-loop-live";
import { runPlanLoop, type PlanHistoryMessage, type PlanLoopClient, type PlanToolCall } from "@/lib/ai/plan-loop";
import { PLAN_LOOP_VERSION } from "@/lib/ai/prompts";
import { parseToolArgs, toolName, type PlanToolArgs, type PlanToolName } from "@/lib/ai/plan-tools";
import type { Database } from "@/lib/db";
import { captures, clients, contractors, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { localDate, PLAN_TIME_ZONE } from "@/lib/plan-lookup";
import { addMoney, roundMoney } from "@/lib/money";
import { matchJobInText } from "@/lib/line-items";
import {
  asksToInvoiceTrackedWork,
  classifyPlanMessage,
  messageAsksForWork,
  parseCompoundWork,
  stripIds,
  parseObviousAct,
} from "@/lib/plan-message";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { buildProposal, type PlanClientRef, type PlanJobRef, type PlanPreview } from "@/lib/plan-proposal";
import { describeReplyBody } from "@/lib/plans";
import { answerPlanQuestion, chatPlanReply } from "@/lib/services/plan-answers";
import { assertCaptureRateLimit } from "@/lib/services/capture-rate-limit";
import { requireJob } from "@/lib/services/internal";
import { previewStoredProposal } from "@/lib/services/plan-proposals";
import { NotFoundError } from "@/lib/services/context";
import { lastConfirmedCapture, previewChange } from "@/lib/services/plan-changes";
import {
  businessSnapshot,
  findClients,
  findDocuments,
  findJobs,
  getDocumentDetail,
  getJobDetail,
  priceSourceLine,
  searchLines,
} from "@/lib/services/plan-reads";
import { parsePlanChange, type ChangeLine, type LineEdit, type PlanChange } from "@/lib/plan-changes";

export const EXTRACTION_FAILED_MESSAGE = "We couldn't read that. You can add lines manually on the review screen.";

/** Cards one message may make. */
const MAX_CARDS = 6;
/** Recent jobs named, with ids, in the model's context so it can often act without a find. */
const CONTEXT_JOBS = 15;
const COULD_NOT_WORK_OUT = "I couldn't work that out. Name the job or the document and try again.";
const ASSISTANT_DOWN = "I couldn't answer that just now. Try again in a minute.";

/** A tool call the model can fix: the message goes back to it as the tool result. */
class ToolError extends Error {}
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

export type PlanAskOption = { label: string; jobId: string | null };

export type PlanAgentPart =
  | { kind: "card"; captureId: string; body: string; jobTitle: string | null; preview: PlanPreview | null }
  | { kind: "text"; body: string }
  /** A question with choices. A choice is sent back as the contractor's next message. */
  | { kind: "ask"; body: string; options: PlanAskOption[] };

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
  const text = parts.find((part): part is Extract<PlanAgentPart, { kind: "text" | "ask" }> => part.kind === "text" || part.kind === "ask");
  // The phone shows `reply` only, so a question carries its choices as text there.
  const reply =
    text?.kind === "ask" && text.options.length ? `${text.body}\n${text.options.map((option) => `• ${option.label}`).join("\n")}` : text?.body;
  return {
    captureId: card?.captureId ?? "",
    status,
    reviewUrl: card ? `/app/captures/${card.captureId}` : "/app",
    preview: null,
    transcript,
    reply: card ? null : (reply ?? null),
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
    // The rules answer only what they can finish. Anything else goes to the model and its tools.
    const answered = await answerPlanQuestion(db, contractor.id, transcript, selected?.id, contractor.labourRateHourly);
    if (answered) {
      await remember(db, contractor.id, input.jobId, transcript, "discarded", type);
      return { ...resultFrom([{ kind: "text", body: answered.reply }], transcript, "needs_review"), jobTitle: answered.jobTitle };
    }
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
        proposal: trackedInvoiceProposal(job),
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
  let cards = 0;
  const started = Date.now();
  const trace: { tool: string; ok: boolean; ms: number }[] = [];
  const ctx = { db, contractorId: contractor.id };
  const said = [evidence, transcript].filter(Boolean).join("\n") || null;
  const ownJob = (id: string | undefined) => (id ? (jobRefs.find((job) => job.id === id) ?? null) : null);

  const json = (value: unknown) => JSON.stringify(value);
  const notFound = (what: string) => json({ error: `${what} not found. Use a find tool to get its id.` });

  /** A price copied from the contractor's own records: the recorded price wins, and the card says where it came from. */
  async function priced(line: { unit_price?: number; price_source?: string; quantity: number }) {
    if (!line.price_source) return { unit_price: line.unit_price ?? null, source_note: null as string | null };
    const source = await priceSourceLine(ctx, line.price_source);
    if (!source) throw new ToolError("price_source is not one of your lines. Use an id from search_lines.");
    return { unit_price: source.unitPrice, source_note: source.note };
  }

  async function storeChangeCard(raw: PlanChange) {
    if (cards >= MAX_CARDS) return json({ drafted: false, reason: "That's enough cards for one message." });
    const change = parsePlanChange(raw);
    if (!change) return json({ error: "That change is not valid. Check the ids and values." });
    let changePreview: PlanPreview;
    try {
      changePreview = await previewChange(ctx, change, said);
    } catch (error) {
      if (error instanceof NotFoundError) return json({ error: `${error.message} Use a find tool to get its id.` });
      throw error;
    }
    cards += 1;
    const captureId = newId();
    const proposal: DescribeExtraction = {
      intent: null,
      client_name: null,
      job_title: changePreview.jobTitle,
      site_address: null,
      scope_notes: null,
      lines: [],
      warnings: [],
      action: "change",
      job_id: changePreview.jobId,
      change,
      evidence,
    };
    await db.insert(captures).values({
      id: captureId,
      contractorId: contractor.id,
      jobId: changePreview.jobId,
      type,
      status: "needs_review",
      transcript,
      extraction: proposal,
      model,
      latencyMs: Date.now() - started,
      promptVersion: PLAN_LOOP_VERSION,
      createdAt: Date.now(),
    });
    if (!preview) preview = changePreview;
    parts.push({ kind: "card", captureId, body: changePreview.title, jobTitle: changePreview.jobTitle, preview: changePreview });
    return json({ drafted: true, title: changePreview.title, can_confirm: changePreview.canConfirm, blockers: changePreview.blockers });
  }

  async function proposeWork(args: PlanToolArgs<"propose_work">) {
    if (cards >= MAX_CARDS) return json({ drafted: false, reason: "That's enough cards for one message." });
    const job = ownJob(args.job_id);
    if (args.job_id && !job) return notFound("Job");
    const clientRow = args.client_id ? (clientRefs.find((row) => row.id === args.client_id) ?? null) : null;
    if (args.client_id && !clientRow) return notFound("Client");
    const lines = [];
    for (const line of args.lines) {
      const price = await priced(line);
      lines.push({
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_cost: line.unit_cost ?? null,
        unit_price:
          !line.price_source && line.unit_cost != null && line.markup_amount != null
            ? addMoney(line.unit_cost, line.markup_amount)
            : price.unit_price,
        source_note: price.source_note,
      });
    }
    cards += 1;
    const card = await storeProposal(db, contractor, {
      transcript,
      jobId: input.jobId,
      // An id from a find tool is as good as the job open in Plan.
      selected: job ?? selected,
      extraction: {
        intent: args.intent ?? "log",
        client_name: clientRow?.name ?? args.client_name ?? null,
        job_title: job?.title ?? args.job_title ?? null,
        site_address: args.site_address ?? null,
        scope_notes: args.notes ?? null,
        warnings: [],
        lines,
      },
      trustJobTitle: Boolean(job || args.job_title),
      model,
      latencyMs: Date.now() - started,
      jobs: jobRefs,
      clients: clientRefs,
      type,
      evidence,
    });
    if (!card) {
      cards -= 1;
      return json({ drafted: false, reason: "Nothing to propose from that." });
    }
    if (!preview) preview = card.preview;
    parts.push(card.part);
    return json({ drafted: true, title: card.part.body, job: card.part.jobTitle, can_confirm: card.preview?.canConfirm ?? false, blockers: card.preview?.blockers ?? [] });
  }

  async function proposeTrackedInvoice(jobId: string) {
    const job = ownJob(jobId);
    if (!job) return notFound("Job");
    if (cards >= MAX_CARDS) return json({ drafted: false, reason: "That's enough cards for one message." });
    cards += 1;
    const card = await storeProposal(db, contractor, {
      transcript,
      jobId: input.jobId,
      selected,
      proposal: trackedInvoiceProposal(job),
      trustJobTitle: true,
      model,
      type,
      evidence: null,
    });
    if (!card) return json({ drafted: false, reason: "Nothing to propose from that." });
    if (!preview) preview = card.preview;
    parts.push(card.part);
    return json({ drafted: true, title: card.part.body, can_confirm: card.preview?.canConfirm ?? false, blockers: card.preview?.blockers ?? [] });
  }

  async function run(name: PlanToolName, raw: string): Promise<string> {
    const parsed = parseToolArgs(name, raw);
    if (!parsed.ok) return json({ error: `Could not read that call. ${parsed.problem}` });
    switch (name) {
      case "find_jobs":
        return json(await findJobs(ctx, parsed.args as PlanToolArgs<"find_jobs">));
      case "get_job":
        return json(await getJobDetail(ctx, (parsed.args as PlanToolArgs<"get_job">).job_id));
      case "find_documents": {
        const { doc_type, ...rest } = parsed.args as PlanToolArgs<"find_documents">;
        return json(await findDocuments(ctx, { ...rest, type: doc_type }));
      }
      case "get_document":
        return json(await getDocumentDetail(ctx, parsed.args as PlanToolArgs<"get_document">));
      case "find_clients":
        return json(await findClients(ctx, parsed.args as PlanToolArgs<"find_clients">));
      case "search_lines":
        return json(await searchLines(ctx, parsed.args as PlanToolArgs<"search_lines">));
      case "business_snapshot":
        return json(await businessSnapshot(ctx, parsed.args as PlanToolArgs<"business_snapshot">));
      case "propose_work":
        return proposeWork(parsed.args as PlanToolArgs<"propose_work">);
      case "propose_invoice": {
        const args = parsed.args as PlanToolArgs<"propose_invoice">;
        if (args.job_id) return proposeTrackedInvoice(args.job_id);
        return storeChangeCard({ kind: "invoice_from_quote", quote_id: args.quote_id! });
      }
      case "propose_document_change": {
        const change = await documentChange(parsed.args as PlanToolArgs<"propose_document_change">, priced);
        return typeof change === "string" ? json({ error: change }) : storeChangeCard(change);
      }
      case "propose_job_change": {
        const change = jobChange(parsed.args as PlanToolArgs<"propose_job_change">);
        return typeof change === "string" ? json({ error: change }) : storeChangeCard(change);
      }
      case "propose_client": {
        const args = parsed.args as PlanToolArgs<"propose_client">;
        return storeChangeCard({ kind: "client", ...args });
      }
      case "propose_send": {
        const args = parsed.args as PlanToolArgs<"propose_send">;
        return storeChangeCard({ kind: "send", document_id: args.document_id, reminder: args.reminder ?? false });
      }
      case "propose_settings":
        return storeChangeCard({ kind: "settings", ...(parsed.args as PlanToolArgs<"propose_settings">) });
      case "propose_undo": {
        const target = await lastConfirmedCapture(ctx);
        if (!target) return json({ error: "Nothing was confirmed in the last day, so there is nothing to undo." });
        return storeChangeCard({ kind: "undo", capture_id: target });
      }
      // Ids are for tool calls. Whatever the model writes, the contractor never sees one.
      case "reply": {
        const text = stripIds((parsed.args as PlanToolArgs<"reply">).text);
        if (!text) return json({ error: "The reply was empty. Write it without ids." });
        parts.push({ kind: "text", body: text });
        return json({ sent: true });
      }
      case "ask": {
        const args = parsed.args as PlanToolArgs<"ask">;
        const options = args.options
          .map((option) => ({ label: stripIds(option.label), jobId: ownJob(option.job_id)?.id ?? null }))
          .filter((option) => option.label);
        parts.push({ kind: "ask", body: stripIds(args.question), options });
        return json({ asked: true });
      }
    }
  }

  async function execute(call: PlanToolCall) {
    const name = toolName(call.name);
    const at = Date.now();
    let result: string;
    try {
      result = name ? await run(name, call.arguments) : json({ error: "Unknown tool." });
    } catch (error) {
      if (error instanceof ToolError) result = json({ error: error.message });
      else if (error instanceof NotFoundError) result = json({ error: `${error.message} Use a find tool to get its id.` });
      else throw error;
    }
    trace.push({ tool: call.name, ok: !/"error"|"drafted":false/.test(result), ms: Date.now() - at });
    return result;
  }

  const settings = await contractorSettings(db, contractor.id);
  const jobList =
    jobRows
      .slice(0, CONTEXT_JOBS)
      .map((row) => `${row.title}${row.clientName ? ` (${row.clientName})` : ""} [id ${row.id}]`)
      .join("; ") || "(none)";
  const contextNote = [
    `Today: ${localDate(Date.now())} (${PLAN_TIME_ZONE})`,
    selected ? `Open job: ${selected.title} [id ${selected.id}]` : "Open job: none",
    `Labour rate: $${contractor.labourRateHourly}/h. Material markup: ${settings?.defaultMarkupPct ?? 0} %. Tax: ${settings?.taxLabel ?? "HST"} ${roundMoney((settings?.taxRate ?? 0) * 100)} %.`,
    `Recent jobs: ${jobList}`,
  ].join("\n");

  let outcome: "card" | "reply" | "ask" | "failed" = "failed";
  let loopFailed = false;
  try {
    try {
      await runPlanLoop({
        client,
        contextNote,
        userText: transcript,
        history: input.history,
        execute,
        onStatus: status,
        hasOutput: () => parts.length > 0,
      });
    } catch (caught) {
      console.error({
        event: "plan_loop_failed",
        name: caught instanceof Error ? caught.name : "Error",
        kind: loopFailureKind(caught),
      });
      loopFailed = true;
      if (parts.length > 0) parts.push({ kind: "text", body: "I couldn't finish the rest of that." });
    }

    if (parts.length === 0) {
      const drafted = await draftExtractions(parseCompoundWork(transcript) ?? []);
      if (drafted) {
        outcome = "card";
        return drafted;
      }
      // "Add it yourself" only makes sense when the message asked to add, quote or invoice something.
      if (messageAsksForWork(transcript)) return await failed(db, contractor.id, input.jobId, transcript, type);
      if (loopFailed) {
        // The assistant could not be reached. Say so, rather than blaming how the message was worded.
        return resultFrom([{ kind: "text", body: ASSISTANT_DOWN }], transcript, "failed");
      }
      parts.push({ kind: "text", body: COULD_NOT_WORK_OUT });
    }

    outcome = parts.some((part) => part.kind === "card") ? "card" : parts.some((part) => part.kind === "ask") ? "ask" : "reply";
    // An answer or a question still used the model; record it so it counts toward the hourly limit.
    if (outcome !== "card") await remember(db, contractor.id, input.jobId, transcript, "discarded", type, model);
    return { ...resultFrom(parts, transcript, "needs_review"), preview };
  } finally {
    console.info({
      event: "plan_turn_finished",
      contractorId: contractor.id,
      model,
      outcome,
      cards: parts.filter((part) => part.kind === "card").length,
      tools: trace,
      ms: Date.now() - started,
    });
  }
}

async function remember(
  db: Database,
  contractorId: string,
  jobId: string | null | undefined,
  transcript: string,
  captureStatus: "discarded" | "failed",
  type: CaptureType,
  /** Set when the model answered, so the row counts toward the hourly limit. */
  model: string | null = null,
) {
  await db.insert(captures).values({
    id: newId(),
    contractorId,
    jobId: jobId ?? null,
    type,
    model,
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


function trackedInvoiceProposal(job: PlanJobRef): DescribeExtraction {
  return {
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
  };
}

async function contractorSettings(db: Database, contractorId: string) {
  const [row] = await db
    .select({ defaultMarkupPct: contractors.defaultMarkupPct, taxLabel: contractors.taxLabel, taxRate: contractors.taxRate })
    .from(contractors)
    .where(eq(contractors.id, contractorId))
    .limit(1);
  return row ?? null;
}

type Priced = (line: { unit_price?: number; price_source?: string; quantity: number }) => Promise<{ unit_price: number | null; source_note: string | null }>;

/** A propose_document_change call as a change card, or the reason it can't be one. */
async function documentChange(args: PlanToolArgs<"propose_document_change">, priced: Priced): Promise<PlanChange | string> {
  const document_id = args.document_id;
  const status = { mark_sent: "sent", mark_approved: "approved", mark_declined: "declined", mark_paid: "paid" } as const;
  switch (args.action) {
    case "mark_sent":
    case "mark_approved":
    case "mark_declined":
    case "mark_paid":
      return { kind: "document_status", document_id, to: status[args.action] };
    case "add_lines": {
      if (!args.lines.length) return "add_lines needs lines.";
      const add: ChangeLine[] = [];
      for (const line of args.lines) {
        const price = await priced(line);
        add.push({
          kind: line.kind,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_price:
            !line.price_source && line.unit_cost != null && line.markup_amount != null
              ? addMoney(line.unit_cost, line.markup_amount)
              : price.unit_price,
          source_note: price.source_note,
        });
      }
      return { kind: "document_lines", document_id, add, update: [], remove: [] };
    }
    case "change_lines": {
      if (!args.changes.length) return "change_lines needs changes, one per line id.";
      const update: LineEdit[] = [];
      for (const edit of args.changes) {
        const price =
          edit.price_source || edit.unit_price !== undefined
            ? await priced({ unit_price: edit.unit_price, price_source: edit.price_source, quantity: edit.quantity ?? 1 })
            : null;
        update.push({
          line_id: edit.line_id,
          description: edit.description,
          quantity: edit.quantity,
          unit: edit.unit,
          unit_price: price?.unit_price ?? undefined,
          source_note: price?.source_note ?? null,
        });
      }
      return { kind: "document_lines", document_id, add: [], update, remove: [] };
    }
    case "remove_lines":
      if (!args.line_ids.length) return "remove_lines needs line_ids from get_document.";
      return { kind: "document_lines", document_id, add: [], update: [], remove: args.line_ids };
    case "set_details":
      return { kind: "document_details", document_id, due_date: args.due_date, valid_until: args.valid_until, notes: args.notes };
    case "add_unbilled":
      return { kind: "add_unbilled_to_invoice", invoice_id: document_id };
    case "delete_draft":
      return { kind: "delete_draft", document_id };
  }
}

/** A propose_job_change call as a change card, or the reason it can't be one. */
function jobChange(args: PlanToolArgs<"propose_job_change">): PlanChange | string {
  switch (args.action) {
    case "set_status":
      return args.status ? { kind: "job_status", job_id: args.job_id, to: args.status } : "set_status needs status.";
    case "edit_details":
      return { kind: "job_details", job_id: args.job_id, title: args.title, site_address: args.site_address, notes: args.notes };
    case "move_lines":
      if (!args.to_job_id || !args.line_ids.length) return "move_lines needs to_job_id and line_ids from get_job.";
      return { kind: "move_lines", job_id: args.job_id, to_job_id: args.to_job_id, line_ids: args.line_ids };
  }
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

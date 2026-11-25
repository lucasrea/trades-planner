import { and, asc, desc, eq } from "drizzle-orm";
import { parseDescribeExtraction } from "@/lib/ai/extraction-types";
import { captures, jobs, planMessages, plans } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import type { PlanPreview } from "@/lib/plan-proposal";
import { describeReplyBody, PLAN_NEW, planOutcome, planSummaryTitle, type PlanOutcome } from "@/lib/plans";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import type { PlanAgentResult, PlanAskOption } from "@/lib/services/plan-agent";
import { previewStoredProposal } from "@/lib/services/plan-proposals";

const LIST_LIMIT = 100;

export type PlanSummary = { id: string; title: string; jobTitle: string | null; updatedAt: number };

export type PlanThreadMessage = {
  id: string;
  role: "user" | "plan";
  body: string;
  captureId: string | null;
  reviewUrl: string | null;
  captureType: string | null;
  /** Null for the contractor's own messages. */
  outcome: PlanOutcome | null;
  /** The review card, only while the proposal is waiting. Rebuilt from the capture, never stored. */
  preview: PlanPreview | null;
  /** Choices offered with a Plan question. Empty for everything else. */
  options: PlanAskOption[];
};

function readOptions(value: unknown): PlanAskOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) =>
    option && typeof option === "object" && typeof (option as { label?: unknown }).label === "string"
      ? [{ label: (option as { label: string }).label, jobId: typeof (option as { jobId?: unknown }).jobId === "string" ? (option as { jobId: string }).jobId : null }]
      : [],
  );
}

export async function requirePlan(ctx: ServiceContext, planId: string) {
  const [plan] = await ctx.db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.contractorId, ctx.contractorId)))
    .limit(1);
  if (!plan) throw new NotFoundError("Plan not found.");
  return plan;
}

/** Check a plan target before any work is done. Undefined means the message is not part of a plan. */
export async function assertPlanTarget(ctx: ServiceContext, planId: string | undefined) {
  if (planId && planId !== PLAN_NEW) await requirePlan(ctx, planId);
}

/** Recent text turns for an existing plan, oldest first, so follow-up messages keep context. */
export async function listRecentPlanHistory(
  ctx: ServiceContext,
  planId: string | undefined,
  limit = 10,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  if (!planId || planId === PLAN_NEW) return [];
  const rows = await ctx.db
    .select({ role: planMessages.role, body: planMessages.body, options: planMessages.options })
    .from(planMessages)
    .where(and(eq(planMessages.planId, planId), eq(planMessages.contractorId, ctx.contractorId)))
    .orderBy(desc(planMessages.createdAt))
    .limit(limit);
  return rows
    .reverse()
    .filter((row) => row.body.trim().length > 0)
    .map((row) => ({
      role: row.role === "plan" ? ("assistant" as const) : ("user" as const),
      // A question keeps its choices, so "the second one" still means something on the next message.
      content: readOptions(row.options).length
        ? `${row.body}\nChoices: ${readOptions(row.options)
            .map((option) => option.label)
            .join("; ")}`
        : row.body,
    }));
}

/** This contractor's plans, most recently used first. */
export async function listPlans(ctx: ServiceContext): Promise<PlanSummary[]> {
  return ctx.db
    .select({ id: plans.id, title: plans.title, jobTitle: plans.jobTitle, updatedAt: plans.updatedAt })
    .from(plans)
    .where(eq(plans.contractorId, ctx.contractorId))
    .orderBy(desc(plans.updatedAt), desc(plans.createdAt))
    .limit(LIST_LIMIT);
}

/** One plan with its messages. Another contractor's plan id is not found. */
export async function getPlanThread(ctx: ServiceContext, planId: string) {
  const plan = await requirePlan(ctx, planId);
  const rows = await ctx.db
    .select({
      id: planMessages.id,
      role: planMessages.role,
      body: planMessages.body,
      captureId: planMessages.captureId,
      options: planMessages.options,
      captureStatus: captures.status,
      captureType: captures.type,
      extraction: captures.extraction,
      transcript: captures.transcript,
    })
    .from(planMessages)
    .leftJoin(captures, and(eq(captures.id, planMessages.captureId), eq(captures.contractorId, ctx.contractorId)))
    .where(and(eq(planMessages.planId, plan.id), eq(planMessages.contractorId, ctx.contractorId)))
    .orderBy(asc(planMessages.createdAt));

  const messages: PlanThreadMessage[] = await Promise.all(
    rows.map(async (row) => {
      const isReply = row.role === "plan";
      const outcome = isReply && row.captureStatus ? planOutcome(row.captureStatus) : null;
      let preview: PlanPreview | null = null;
      if (outcome === "waiting" && row.captureType !== "receipt") {
        const proposal = parseDescribeExtraction(row.extraction);
        if (proposal) {
          try {
            preview = await previewStoredProposal(ctx, proposal, row.transcript);
          } catch {
            preview = null;
          }
        }
      }
      return {
        id: row.id,
        role: isReply ? ("plan" as const) : ("user" as const),
        body: row.body,
        captureId: row.captureId,
        reviewUrl: row.captureId ? `/app/captures/${row.captureId}` : null,
        captureType: row.captureType,
        outcome,
        preview,
        options: isReply ? readOptions(row.options) : [],
      };
    }),
  );
  return { plan: { id: plan.id, title: plan.title, jobTitle: plan.jobTitle }, messages };
}

/**
 * Add one exchange to a plan: what the contractor sent and the Plan's reply for the capture.
 * `planId` is an existing plan, or "new" to start one titled from the message. Returns the plan id.
 */
export async function recordPlanTurn(
  ctx: ServiceContext,
  input: {
    planId: string;
    userBody: string;
    replyBody: string;
    captureId: string | null;
    /** More than one Plan message for this turn. Each card is its own row. */
    replies?: { body: string; captureId: string | null; options?: PlanAskOption[] | null }[];
    /** Model summary of this exchange. Used as the sidebar name on the first message. */
    summaryTitle?: string | null;
    /** Job this exchange is about. Shown as the sidebar tag. A later message that names a job replaces it. */
    jobTitle?: string | null;
    /** Owned job to tag when the caller has an id but not the title. */
    jobId?: string | null;
  },
): Promise<string> {
  const userBody = input.userBody.trim();
  if (!userBody) throw new ValidationError("Message is required.");
  return ctx.db.transaction(async (tx) => {
    let jobTitle = input.jobTitle?.trim() || null;
    if (!jobTitle && input.jobId) {
      const [job] = await tx
        .select({ title: jobs.title })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), eq(jobs.contractorId, ctx.contractorId)))
        .limit(1);
      jobTitle = job?.title ?? null;
    }
    const txCtx = { db: tx, contractorId: ctx.contractorId };
    const now = Date.now();
    let planId = input.planId;
    if (planId === PLAN_NEW) {
      planId = newId();
      await tx.insert(plans).values({
        id: planId,
        contractorId: ctx.contractorId,
        title: planSummaryTitle(input.summaryTitle, userBody),
        jobTitle,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await requirePlan(txCtx, planId);
      await tx
        .update(plans)
        .set({ updatedAt: now, ...(jobTitle ? { jobTitle } : {}) })
        .where(and(eq(plans.id, planId), eq(plans.contractorId, ctx.contractorId)));
    }
    const replyRows: { body: string; captureId: string | null; options?: PlanAskOption[] | null }[] = input.replies?.length
      ? input.replies
      : [{ body: input.replyBody, captureId: input.captureId }];
    await tx.insert(planMessages).values([
      { id: newId(), planId, contractorId: ctx.contractorId, role: "user", body: userBody, captureId: input.captureId, createdAt: now },
      ...replyRows.map((reply, index) => ({
        id: newId(),
        planId,
        contractorId: ctx.contractorId,
        role: "plan" as const,
        body: reply.body,
        captureId: reply.captureId,
        options: reply.options?.length ? reply.options : null,
        createdAt: now + 1 + index,
      })),
    ]);
    return planId;
  });
}

/**
 * Save one Plan message and every card or answer the agent gave for it. Typed and spoken messages
 * both land here. A failure to save the thread is logged and returns null; the capture still stands,
 * so the caller can open its review page.
 */
export async function recordAgentTurn(
  ctx: ServiceContext,
  input: { planId: string | undefined; userBody: string; result: PlanAgentResult; jobId?: string | null },
): Promise<string | null> {
  const { result } = input;
  if (!input.planId) return null;
  const replies = result.parts.map((part) => ({
    body: part.body,
    captureId: part.kind === "card" ? part.captureId : null,
    options: part.kind === "ask" ? part.options : null,
  }));
  if (replies.length === 1 && !replies[0]!.captureId && result.captureId) replies[0]!.captureId = result.captureId;
  const first = replies[0] ?? {
    body: describeReplyBody({ status: result.status, previewTitle: result.preview?.title ?? null }),
    captureId: result.captureId || null,
  };
  const card = result.parts.find((part) => part.kind === "card");
  try {
    return await recordPlanTurn(ctx, {
      planId: input.planId,
      userBody: input.userBody,
      replyBody: first.body,
      captureId: replies.length > 1 ? result.captureId || null : first.captureId,
      replies: replies.length > 1 || replies.some((reply) => reply.options?.length) ? replies : undefined,
      summaryTitle: result.reply ? null : (card?.body ?? result.preview?.title ?? null),
      jobTitle: result.jobTitle ?? result.preview?.jobTitle ?? null,
      jobId: input.jobId,
    });
  } catch {
    // Never the message, transcript or model output: those can hold client details.
    console.error({ event: "plan_turn_failed", captureId: result.captureId, contractorId: ctx.contractorId });
    return null;
  }
}

/** What the web Plan screen gets back for a message, typed or spoken. */
export function planTurnResponse(result: PlanAgentResult, planId: string | null) {
  return {
    captureId: result.captureId,
    status: result.status,
    reviewUrl: result.reviewUrl,
    preview: result.preview,
    transcript: result.transcript,
    reply: result.reply,
    jobTitle: result.jobTitle,
    planId,
  };
}

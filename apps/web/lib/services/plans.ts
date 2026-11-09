import { and, asc, desc, eq } from "drizzle-orm";
import { parseDescribeExtraction } from "@/lib/ai/extraction-types";
import { captures, planMessages, plans } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import type { PlanPreview } from "@/lib/plan-proposal";
import { PLAN_NEW, planOutcome, planTitle, type PlanOutcome } from "@/lib/plans";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { previewStoredProposal } from "@/lib/services/plan-proposals";

const LIST_LIMIT = 100;

export type PlanSummary = { id: string; title: string; updatedAt: number };

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
};

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

/** This contractor's plans, most recently used first. */
export async function listPlans(ctx: ServiceContext): Promise<PlanSummary[]> {
  return ctx.db
    .select({ id: plans.id, title: plans.title, updatedAt: plans.updatedAt })
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
      captureStatus: captures.status,
      captureType: captures.type,
      extraction: captures.extraction,
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
            preview = await previewStoredProposal(ctx, proposal);
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
      };
    }),
  );
  return { plan: { id: plan.id, title: plan.title }, messages };
}

/**
 * Add one exchange to a plan: what the contractor sent and the Plan's reply for the capture.
 * `planId` is an existing plan, or "new" to start one titled from the message. Returns the plan id.
 */
export async function recordPlanTurn(
  ctx: ServiceContext,
  input: { planId: string; userBody: string; replyBody: string; captureId: string },
): Promise<string> {
  const userBody = input.userBody.trim();
  if (!userBody) throw new ValidationError("Message is required.");
  return ctx.db.transaction(async (tx) => {
    const txCtx = { db: tx, contractorId: ctx.contractorId };
    const now = Date.now();
    let planId = input.planId;
    if (planId === PLAN_NEW) {
      planId = newId();
      await tx.insert(plans).values({
        id: planId,
        contractorId: ctx.contractorId,
        title: planTitle(userBody),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await requirePlan(txCtx, planId);
      await tx.update(plans).set({ updatedAt: now }).where(and(eq(plans.id, planId), eq(plans.contractorId, ctx.contractorId)));
    }
    await tx.insert(planMessages).values([
      { id: newId(), planId, contractorId: ctx.contractorId, role: "user", body: userBody, captureId: input.captureId, createdAt: now },
      { id: newId(), planId, contractorId: ctx.contractorId, role: "plan", body: input.replyBody, captureId: input.captureId, createdAt: now + 1 },
    ]);
    return planId;
  });
}

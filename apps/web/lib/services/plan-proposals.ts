import { and, eq } from "drizzle-orm";
import { parseDescribeExtraction, type DescribeExtraction } from "@/lib/ai/extraction-types";
import { captures, clients, contractors } from "@/lib/db/schema";
import { previewProposal, toConfirmPlan, type PlanPreview } from "@/lib/plan-proposal";
import { confirmCapture, discardCapture } from "@/lib/services/captures";
import { ConflictError, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { createJobWithClient } from "@/lib/services/jobs";
import { requireJob } from "@/lib/services/internal";

export type PlanConfirmResult =
  | { kind: "job"; jobId: string }
  | { kind: "document"; documentId: string }
  | { kind: "log"; jobIds: string[] };

async function labourRateFor(ctx: ServiceContext) {
  const [row] = await ctx.db
    .select({ labourRateHourly: contractors.labourRateHourly })
    .from(contractors)
    .where(eq(contractors.id, ctx.contractorId))
    .limit(1);
  if (!row) throw new NotFoundError("Contractor not found.");
  return row.labourRateHourly;
}

/** The preview card for a stored proposal. Looks up display names, scoped by contractor_id. */
export async function previewStoredProposal(
  ctx: ServiceContext,
  proposal: DescribeExtraction,
  transcript: string | null,
): Promise<PlanPreview | null> {
  if (!proposal.action) return null;
  const [labourRate, job, client] = await Promise.all([
    labourRateFor(ctx),
    proposal.job_id ? requireJob(ctx.db, ctx.contractorId, proposal.job_id) : null,
    proposal.client_id
      ? ctx.db
          .select({ name: clients.name })
          .from(clients)
          .where(and(eq(clients.id, proposal.client_id), eq(clients.contractorId, ctx.contractorId)))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null,
  ]);
  return previewProposal(proposal, { labourRate, jobTitle: job?.title, clientName: client?.name, transcript });
}

/**
 * Confirm a Plan proposal. The stored proposal is the only input: nothing the browser sends can change
 * the lines, so the confirm calls the same services as the review screen with what was previewed.
 */
export async function confirmPlanProposal(ctx: ServiceContext, captureId: string): Promise<PlanConfirmResult> {
  if (!captureId.trim()) throw new ValidationError("Capture id is required.");
  const [capture] = await ctx.db
    .select()
    .from(captures)
    .where(and(eq(captures.id, captureId), eq(captures.contractorId, ctx.contractorId)))
    .limit(1);
  if (!capture) throw new NotFoundError("Capture not found.");
  if (capture.type === "receipt") throw new ValidationError("Receipts are not confirmed from Plan.");

  const proposal = parseDescribeExtraction(capture.extraction);
  if (!proposal?.action) throw new ValidationError("There is nothing to confirm for this message.");

  const job = proposal.job_id ? await requireJob(ctx.db, ctx.contractorId, proposal.job_id) : null;
  const plan = toConfirmPlan(proposal, {
    labourRate: await labourRateFor(ctx),
    job: job ? { id: job.id, clientId: job.clientId } : null,
    transcript: capture.transcript,
  });
  if (!plan.ok) throw new ValidationError(plan.reason);

  if (plan.kind === "capture") {
    const result = await confirmCapture(ctx, { captureId: capture.id, ...plan.input });
    return result.kind === "document" ? result : { kind: "log", jobIds: result.jobIds };
  }

  return ctx.db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(captures)
      .where(and(eq(captures.id, capture.id), eq(captures.contractorId, ctx.contractorId)))
      .for("update")
      .limit(1);
    if (!locked) throw new NotFoundError("Capture not found.");
    if (locked.status === "confirmed" && locked.jobId) return { kind: "job" as const, jobId: locked.jobId };
    if (locked.status !== "needs_review") throw new ConflictError("This message was already confirmed or cancelled.");
    const jobId = await createJobWithClient({ db: tx, contractorId: ctx.contractorId }, plan.input);
    await tx
      .update(captures)
      .set({ status: "confirmed", confirmedAt: Date.now(), jobId })
      .where(and(eq(captures.id, capture.id), eq(captures.contractorId, ctx.contractorId)));
    return { kind: "job" as const, jobId };
  });
}

/** Cancel drops the proposal. The message stays in the thread; nothing else is written. */
export async function cancelPlanProposal(ctx: ServiceContext, captureId: string) {
  await discardCapture(ctx, captureId);
}

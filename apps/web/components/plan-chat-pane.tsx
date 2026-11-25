import { notFound } from "next/navigation";
import { PlanChatHost } from "@/components/plan-chat-host";
import type { CaptureJobOption, OpenPlan } from "@/components/capture-bar";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { jobIdForPlanTitle } from "@/lib/plans";
import { getPlanThread } from "@/lib/services/plans";
import { NotFoundError } from "@/lib/services/context";

export async function PlanChatPane({ planId, jobs }: { planId: string | null; jobs: CaptureJobOption[] }) {
  let open: OpenPlan = { id: null, messages: [], jobId: null };
  if (planId) {
    const contractor = await getContractor();
    const ctx = { db: await ensureDb(), contractorId: contractor.id };
    try {
      const thread = await getPlanThread(ctx, planId);
      open = {
        id: thread.plan.id,
        messages: thread.messages,
        jobId: jobIdForPlanTitle(thread.plan.jobTitle, jobs),
      };
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  } else {
    open = { id: null, messages: [], jobId: null };
  }

  return <PlanChatHost key={planId ?? "new"} initial={open} jobs={jobs} planId={planId} />;
}
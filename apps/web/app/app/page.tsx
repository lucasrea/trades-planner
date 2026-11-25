import type { CaptureJobOption, OpenPlan } from "@/components/capture-bar";
import { PlanHomeClient } from "@/components/plan-home-client";
import { ensureDb } from "@/lib/db";
import { getContractor } from "@/lib/auth";
import { jobIdForPlanTitle } from "@/lib/plans";
import { getHome, getJobs } from "@/lib/queries";
import { getPlanThread, listPlans } from "@/lib/services/plans";
import { NotFoundError } from "@/lib/services/context";
import { notFound } from "next/navigation";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const raw = (await searchParams).plan;
  const planId = typeof raw === "string" && raw ? raw : null;

  const contractor = await getContractor();
  const ctx = { db: await ensureDb(), contractorId: contractor.id };
  const [allJobs, plans, home] = await Promise.all([getJobs(), listPlans(ctx), getHome()]);

  const jobs: CaptureJobOption[] = allJobs
    .filter((job) => job.status === "quoted" || job.status === "active")
    .map((job) => ({
      id: job.id,
      title: job.title,
      clientName: job.client?.name ?? null,
    }));

  let initialOpen: OpenPlan = { id: null, messages: [], jobId: null };
  if (planId) {
    try {
      const thread = await getPlanThread(ctx, planId);
      initialOpen = {
        id: thread.plan.id,
        messages: thread.messages,
        jobId: jobIdForPlanTitle(thread.plan.jobTitle, jobs),
      };
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  }

  return (
    <PlanHomeClient
      plans={plans}
      jobs={jobs}
      home={home}
      initialPlanId={planId}
      initialOpen={initialOpen}
    />
  );
}
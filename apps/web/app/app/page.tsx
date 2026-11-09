import { notFound } from "next/navigation";
import { CaptureBar } from "@/components/capture-bar";
import { HomeLists } from "@/components/home-lists";
import { PlanSidebar } from "@/components/plan-list";
import { ReceiptUpload } from "@/components/receipt-upload";
import { ensureDb } from "@/lib/db";
import { getContractor } from "@/lib/auth";
import { getHome, getJobs } from "@/lib/queries";
import { PLAN_NEW } from "@/lib/plans";
import { getPlanThread, listPlans } from "@/lib/services/plans";
import { NotFoundError } from "@/lib/services/context";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const raw = (await searchParams).plan;
  const planId = typeof raw === "string" && raw ? raw : null;

  const contractor = await getContractor();
  const ctx = { db: await ensureDb(), contractorId: contractor.id };
  const [allJobs, plans, home, thread] = await Promise.all([
    getJobs(),
    listPlans(ctx),
    getHome(),
    planId
      ? getPlanThread(ctx, planId).catch((error) => {
          if (error instanceof NotFoundError) return null;
          throw error;
        })
      : Promise.resolve(null),
  ]);
  if (planId && !thread) notFound();

  const jobs = allJobs
    .filter((job) => job.status === "quoted" || job.status === "active")
    .map((job) => ({
      id: job.id,
      title: job.title,
      clientName: job.client?.name ?? null,
    }));
  const open = { id: thread?.plan.id ?? null, messages: thread?.messages ?? [] };

  return (
    <PlanSidebar plans={plans} currentId={open.id}>
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col">
          <CaptureBar key={open.id ?? PLAN_NEW} jobs={jobs} fill plan={open} />
          <div className="pt-3">
            <ReceiptUpload jobs={jobs} planId={open.id ?? PLAN_NEW} />
          </div>
        </div>
        <HomeLists home={home} />
      </div>
    </PlanSidebar>
  );
}

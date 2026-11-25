import { Suspense } from "react";
import { HomeLists } from "@/components/home-lists";
import { PlanChatPane } from "@/components/plan-chat-pane";
import { PlanChatSkeleton } from "@/components/plan-chat-skeleton";
import { PlanSidebar } from "@/components/plan-list";
import { ensureDb } from "@/lib/db";
import { getContractor } from "@/lib/auth";
import { getHome, getJobs } from "@/lib/queries";
import { listPlans } from "@/lib/services/plans";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const raw = (await searchParams).plan;
  const planId = typeof raw === "string" && raw ? raw : null;

  const contractor = await getContractor();
  const ctx = { db: await ensureDb(), contractorId: contractor.id };
  const [allJobs, plans, home] = await Promise.all([getJobs(), listPlans(ctx), getHome()]);

  const jobs = allJobs
    .filter((job) => job.status === "quoted" || job.status === "active")
    .map((job) => ({
      id: job.id,
      title: job.title,
      clientName: job.client?.name ?? null,
    }));

  return (
    <PlanSidebar plans={plans} currentId={planId}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-1">
          <Suspense fallback={<PlanChatSkeleton fill />} key={planId ?? "new"}>
            <PlanChatPane planId={planId} jobs={jobs} />
          </Suspense>
        </div>
        <div className="order-1 shrink-0 lg:order-2">
          <HomeLists home={home} />
        </div>
      </div>
    </PlanSidebar>
  );
}
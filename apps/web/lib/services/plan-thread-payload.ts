import { and, eq, inArray } from "drizzle-orm";
import { clients, jobs as jobsTable } from "@/lib/db/schema";
import { jobIdForPlanTitle } from "@/lib/plans";
import type { ServiceContext } from "@/lib/services/context";
import { getPlanThread } from "@/lib/services/plans";

export async function planThreadPayload(ctx: ServiceContext, planId: string) {
  const thread = await getPlanThread(ctx, planId);
  const jobRows = await ctx.db
    .select({ id: jobsTable.id, title: jobsTable.title, clientName: clients.name })
    .from(jobsTable)
    .leftJoin(clients, and(eq(clients.id, jobsTable.clientId), eq(clients.contractorId, ctx.contractorId)))
    .where(and(eq(jobsTable.contractorId, ctx.contractorId), inArray(jobsTable.status, ["quoted", "active"])));
  const jobs = jobRows.filter((row) => row.title).map((row) => ({ id: row.id, title: row.title, clientName: row.clientName }));
  return {
    id: thread.plan.id,
    title: thread.plan.title,
    jobTitle: thread.plan.jobTitle,
    messages: thread.messages,
    jobId: jobIdForPlanTitle(thread.plan.jobTitle, jobs),
  };
}
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { clients, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { requireJob, touchJob } from "@/lib/services/internal";

const jobStatuses = ["quoted", "active", "done"] as const;
export type JobStatus = (typeof jobStatuses)[number];

function encodeCursor(updatedAt: number, id: string) {
  return `${updatedAt}:${id}`;
}

function decodeCursor(cursor: string) {
  const [updatedAtRaw, id] = cursor.split(":");
  const updatedAt = Number(updatedAtRaw);
  if (!id || !Number.isFinite(updatedAt)) return null;
  return { updatedAt, id };
}

export async function getJob(ctx: ServiceContext, jobId: string) {
  const [row] = await ctx.db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, ctx.contractorId)))
    .where(and(eq(jobs.id, jobId), eq(jobs.contractorId, ctx.contractorId)))
    .limit(1);
  return row ? { ...row.job, client: row.client } : null;
}

export async function listJobs(ctx: ServiceContext, options: { cursor?: string | null; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const conditions = [eq(jobs.contractorId, ctx.contractorId)];
  if (cursor) {
    conditions.push(or(lt(jobs.updatedAt, cursor.updatedAt), and(eq(jobs.updatedAt, cursor.updatedAt), lt(jobs.id, cursor.id)))!);
  }
  const rows = await ctx.db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, ctx.contractorId)))
    .where(and(...conditions))
    .orderBy(desc(jobs.updatedAt), desc(jobs.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const jobIds = page.map(({ job }) => job.id);
  const unbilledByJob = new Map<string, number>();
  if (jobIds.length) {
    const totals = await ctx.db
      .select({ jobId: lineItems.jobId, unbilled: sql<number>`coalesce(sum(${lineItems.lineTotal}), 0)`.mapWith(Number) })
      .from(lineItems)
      .where(and(eq(lineItems.contractorId, ctx.contractorId), inArray(lineItems.jobId, jobIds), isNull(lineItems.documentId), isNull(lineItems.billedDocumentId)))
      .groupBy(lineItems.jobId);
    for (const row of totals) unbilledByJob.set(row.jobId, row.unbilled);
  }
  const items = page.map(({ job, client }) => ({ ...job, client, unbilledTotal: unbilledByJob.get(job.id) ?? 0 }));
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null };
}

export async function createJobWithClient(
  ctx: ServiceContext,
  input: {
    title: string;
    siteAddress?: string;
    notes?: string;
    client: { id: string } | { name: string; email?: string; phone?: string; billingAddress?: string };
  },
) {
  const title = input.title.trim();
  if (!title) throw new ValidationError("Job title is required.");
  return ctx.db.transaction(async (tx) => {
    let clientId: string;
    if ("id" in input.client) {
      const [owned] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.client.id), eq(clients.contractorId, ctx.contractorId))).limit(1);
      if (!owned) throw new NotFoundError("Client not found.");
      clientId = owned.id;
    } else {
      const name = input.client.name.trim();
      if (!name) throw new ValidationError("Client name is required.");
      clientId = newId();
      await tx.insert(clients).values({
        id: clientId,
        contractorId: ctx.contractorId,
        name,
        email: input.client.email?.trim() ?? "",
        phone: input.client.phone?.trim() ?? "",
        billingAddress: input.client.billingAddress?.trim() ?? "",
        createdAt: Date.now(),
      });
    }
    const jobId = newId();
    const now = Date.now();
    await tx.insert(jobs).values({
      id: jobId,
      contractorId: ctx.contractorId,
      clientId,
      title,
      status: "quoted",
      siteAddress: input.siteAddress?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
    });
    return jobId;
  });
}

export async function setJobStatus(ctx: ServiceContext, jobId: string, status: JobStatus) {
  if (!jobStatuses.includes(status)) throw new ValidationError("Invalid job status.");
  const [updated] = await ctx.db.update(jobs).set({ status, updatedAt: Date.now() }).where(and(eq(jobs.id, jobId), eq(jobs.contractorId, ctx.contractorId))).returning({ id: jobs.id });
  if (!updated) throw new NotFoundError("Job not found.");
}

export async function touchJobService(ctx: ServiceContext, jobId: string) {
  await requireJob(ctx.db, ctx.contractorId, jobId);
  await touchJob(ctx.db, ctx.contractorId, jobId);
}

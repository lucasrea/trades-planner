import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getContractor } from "@/lib/auth";
import { roundMoney } from "@/lib/money";
import { ensureDb } from "@/lib/db";
import { clients, jobs, lineItems } from "@/lib/db/schema";
import {
  getDocumentForContractor,
  getDocumentsForContractor,
  getCaptureForContractor,
  getHomeForContractor,
  getJobDocumentsForContractor,
  getTrackedLinesForContractor,
  type DocumentListFilter,
} from "@/lib/queries-v2";

export type { DocumentListFilter };
export {
  getDocumentForContractor,
  getDocumentsForContractor,
  getCaptureForContractor,
  getHomeForContractor,
  getJobDocumentsForContractor,
  getTrackedLinesForContractor,
};

export async function getCapture(id: string) {
  const contractor = await getContractor();
  return getCaptureForContractor(await ensureDb(), contractor.id, id);
}

export async function getClients() {
  const contractor = await getContractor();
  const db = await ensureDb();
  return db
    .select()
    .from(clients)
    .where(eq(clients.contractorId, contractor.id))
    .orderBy(desc(clients.createdAt));
}

export async function getClient(id: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.contractorId, contractor.id)))
    .limit(1);
  return row ?? null;
}

export async function getJobs() {
  const contractor = await getContractor();
  const db = await ensureDb();
  const rows = await db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(
      clients,
      and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractor.id)),
    )
    .where(eq(jobs.contractorId, contractor.id))
    .orderBy(desc(jobs.createdAt));
  const mapped = rows.map(({ job, client }) => ({ ...job, client }));
  const jobIds = mapped.map((job) => job.id);
  const unbilledByJob = new Map<string, number>();
  if (jobIds.length) {
    const totals = await db
      .select({
        jobId: lineItems.jobId,
        unbilled: sql<number>`coalesce(sum(${lineItems.lineTotal}), 0)`.mapWith(Number),
      })
      .from(lineItems)
      .where(
        and(
          eq(lineItems.contractorId, contractor.id),
          inArray(lineItems.jobId, jobIds),
          isNull(lineItems.documentId),
          isNull(lineItems.billedDocumentId),
        ),
      )
      .groupBy(lineItems.jobId);
    for (const row of totals) unbilledByJob.set(row.jobId, roundMoney(row.unbilled));
  }
  return mapped.map((job) => ({ ...job, unbilledTotal: unbilledByJob.get(job.id) ?? 0 }));
}

export async function getJob(id: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [row] = await db
    .select({ job: jobs, client: clients })
    .from(jobs)
    .leftJoin(
      clients,
      and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractor.id)),
    )
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)))
    .limit(1);
  if (!row) return null;
  return { ...row.job, client: row.client };
}

export async function getDocuments(filter: DocumentListFilter = {}, cursor?: string | null, limit = 20) {
  const contractor = await getContractor();
  return getDocumentsForContractor(await ensureDb(), contractor.id, filter, cursor, limit);
}

export async function getDocument(id: string) {
  const contractor = await getContractor();
  return getDocumentForContractor(await ensureDb(), contractor.id, id);
}

export async function getJobDocuments(jobId: string) {
  const contractor = await getContractor();
  return getJobDocumentsForContractor(await ensureDb(), contractor.id, jobId);
}

export async function getTrackedLines(jobId: string) {
  const contractor = await getContractor();
  return getTrackedLinesForContractor(await ensureDb(), contractor.id, jobId);
}

export async function getHome(today = new Date().toISOString().slice(0, 10)) {
  const contractor = await getContractor();
  return getHomeForContractor(await ensureDb(), contractor.id, today);
}


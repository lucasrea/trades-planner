import { and, desc, eq } from "drizzle-orm";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import {
  getDocumentForContractor,
  getDocumentsForContractor,
  getCaptureForContractor,
  getCaptureResultJobsForContractor,
  getHomeForContractor,
  getJobDocumentsForContractor,
  getJobForContractor,
  getJobsForContractor,
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
  getJobForContractor,
  getJobsForContractor,
  getTrackedLinesForContractor,
};

export async function getCaptureResultJobs(captureId: string) {
  const contractor = await getContractor();
  return getCaptureResultJobsForContractor(await ensureDb(), contractor.id, captureId);
}

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
  return getJobsForContractor(await ensureDb(), contractor.id);
}

export async function getJob(id: string) {
  const contractor = await getContractor();
  return getJobForContractor(await ensureDb(), contractor.id, id);
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


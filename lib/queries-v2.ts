import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { clients, documents, jobs, lineItems } from "@/lib/db/schema";
import { isOverdue } from "@/lib/documents";

export type DocumentListFilter = { type?: "quote" | "invoice"; status?: string };

function decodeDocumentCursor(cursor: string) {
  const [updatedAtRaw, id] = cursor.split(":");
  const updatedAt = Number(updatedAtRaw);
  if (!id || !Number.isFinite(updatedAt)) return null;
  return { updatedAt, id };
}

function encodeDocumentCursor(updatedAt: number, id: string) {
  return `${updatedAt}:${id}`;
}

export async function getDocumentsForContractor(
  db: Database,
  contractorId: string,
  filter: DocumentListFilter = {},
  cursor?: string | null,
  limit = 20,
) {
  const pageSize = Math.min(Math.max(limit, 1), 100);
  const decoded = cursor ? decodeDocumentCursor(cursor) : null;
  const conditions = [eq(documents.contractorId, contractorId)];
  if (filter.type) conditions.push(eq(documents.type, filter.type));
  if (filter.status) conditions.push(eq(documents.status, filter.status));
  if (decoded) {
    conditions.push(or(lt(documents.updatedAt, decoded.updatedAt), and(eq(documents.updatedAt, decoded.updatedAt), lt(documents.id, decoded.id)))!);
  }
  const rows = await db
    .select({ document: documents, client: clients, job: jobs })
    .from(documents)
    .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, documents.jobId), eq(jobs.contractorId, contractorId)))
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt), desc(documents.id))
    .limit(pageSize + 1);
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page.at(-1)?.document;
  return {
    items: page.map(({ document, client, job }) => ({ ...document, client, job })),
    nextCursor: hasMore && last ? encodeDocumentCursor(last.updatedAt, last.id) : null,
  };
}

export async function getDocumentForContractor(db: Database, contractorId: string, id: string) {
  const [row] = await db
    .select({ document: documents, client: clients, job: jobs })
    .from(documents)
    .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, contractorId)))
    .leftJoin(jobs, and(eq(jobs.id, documents.jobId), eq(jobs.contractorId, contractorId)))
    .where(and(eq(documents.id, id), eq(documents.contractorId, contractorId)))
    .limit(1);
  if (!row) return null;
  const lines = await db.select().from(lineItems).where(and(eq(lineItems.documentId, id), eq(lineItems.contractorId, contractorId)));
  return { ...row.document, client: row.client, job: row.job, lines: lines.slice().sort((a, b) => a.sortOrder - b.sortOrder) };
}

export async function getJobDocumentsForContractor(db: Database, contractorId: string, jobId: string) {
  return db.select().from(documents).where(and(eq(documents.jobId, jobId), eq(documents.contractorId, contractorId))).orderBy(desc(documents.updatedAt));
}

export async function getTrackedLinesForContractor(db: Database, contractorId: string, jobId: string) {
  return db.select().from(lineItems).where(and(eq(lineItems.jobId, jobId), eq(lineItems.contractorId, contractorId), isNull(lineItems.documentId))).orderBy(lineItems.sortOrder, lineItems.createdAt);
}

export async function getHomeForContractor(db: Database, contractorId: string, today: string) {
  const [quotesAwaitingResponse, openJobs, unpaidInvoices] = await Promise.all([
    db.select().from(documents).where(and(eq(documents.contractorId, contractorId), eq(documents.type, "quote"), eq(documents.status, "sent"))).orderBy(desc(documents.updatedAt)).limit(10),
    db
      .select({ job: jobs, client: clients, unbilled: sql<number>`coalesce(sum(${lineItems.lineTotal}), 0)`.mapWith(Number) })
      .from(jobs)
      .leftJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.contractorId, contractorId)))
      .leftJoin(lineItems, and(eq(lineItems.jobId, jobs.id), eq(lineItems.contractorId, contractorId), isNull(lineItems.documentId), isNull(lineItems.billedDocumentId)))
      .where(and(eq(jobs.contractorId, contractorId), inArray(jobs.status, ["quoted", "active"])))
      .groupBy(jobs.id, clients.id)
      .orderBy(desc(jobs.updatedAt))
      .limit(10),
    db
      .select({ document: documents, client: clients })
      .from(documents)
      .leftJoin(clients, and(eq(clients.id, documents.clientId), eq(clients.contractorId, contractorId)))
      .where(and(eq(documents.contractorId, contractorId), eq(documents.type, "invoice"), eq(documents.status, "sent")))
      .orderBy(desc(documents.updatedAt))
      .limit(20),
  ]);
  return {
    quotesAwaitingResponse,
    openJobs: openJobs.map(({ job, client, unbilled }) => ({ ...job, client, unbilledTotal: unbilled })),
    unpaidInvoices: unpaidInvoices.map(({ document, client }) => ({
      ...document,
      client,
      overdue: isOverdue({ type: "invoice", status: document.status as "sent", dueDate: document.dueDate }, today),
    })),
  };
}

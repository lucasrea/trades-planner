import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getContractor } from "@/lib/auth";
import { ensureDb, type Database } from "@/lib/db";
import {
  clients,
  documents,
  invoiceLineItems,
  invoices,
  jobs,
  jobCosts,
  lineItems,
  quoteLineItems,
  quotes,
} from "@/lib/db/schema";
import { isOverdue } from "@/lib/documents";
import type { DraftLine, LineKind } from "@/lib/money";

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
  return rows.map(({ job, client }) => ({ ...job, client }));
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

export async function getJobCosts(jobId: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(jobCosts)
    .where(and(eq(jobCosts.jobId, jobId), eq(jobCosts.contractorId, contractor.id)));
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function getQuotes() {
  const contractor = await getContractor();
  const db = await ensureDb();
  const rows = await db
    .select({ quote: quotes, client: clients, job: jobs })
    .from(quotes)
    .leftJoin(
      clients,
      and(eq(clients.id, quotes.clientId), eq(clients.contractorId, contractor.id)),
    )
    .leftJoin(
      jobs,
      and(eq(jobs.id, quotes.jobId), eq(jobs.contractorId, contractor.id)),
    )
    .where(eq(quotes.contractorId, contractor.id))
    .orderBy(desc(quotes.updatedAt));
  return rows.map(({ quote, client, job }) => ({ ...quote, client, job }));
}

function toDraft(line: {
  id: string;
  kind: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}): DraftLine {
  return {
    id: line.id,
    kind: line.kind as LineKind,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
  };
}

export async function getQuote(id: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [row] = await db
    .select({ quote: quotes, client: clients })
    .from(quotes)
    .leftJoin(
      clients,
      and(eq(clients.id, quotes.clientId), eq(clients.contractorId, contractor.id)),
    )
    .where(and(eq(quotes.id, id), eq(quotes.contractorId, contractor.id)))
    .limit(1);
  if (!row) return null;
  const lines = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, row.quote.id));
  return {
    ...row.quote,
    client: row.client,
    lines: lines.sort((a, b) => a.sortOrder - b.sortOrder).map(toDraft),
  };
}

export async function getInvoices() {
  const contractor = await getContractor();
  const db = await ensureDb();
  const rows = await db
    .select({ invoice: invoices, client: clients, job: jobs, quote: quotes })
    .from(invoices)
    .leftJoin(
      clients,
      and(eq(clients.id, invoices.clientId), eq(clients.contractorId, contractor.id)),
    )
    .leftJoin(
      jobs,
      and(eq(jobs.id, invoices.jobId), eq(jobs.contractorId, contractor.id)),
    )
    .leftJoin(
      quotes,
      and(eq(quotes.id, invoices.quoteId), eq(quotes.contractorId, contractor.id)),
    )
    .where(eq(invoices.contractorId, contractor.id))
    .orderBy(desc(invoices.updatedAt));
  return rows.map(({ invoice, client, job, quote }) => ({ ...invoice, client, job, quote }));
}

export async function getInvoice(id: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .leftJoin(
      clients,
      and(eq(clients.id, invoices.clientId), eq(clients.contractorId, contractor.id)),
    )
    .where(and(eq(invoices.id, id), eq(invoices.contractorId, contractor.id)))
    .limit(1);
  if (!row) return null;
  const lines = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, row.invoice.id));
  return {
    ...row.invoice,
    client: row.client,
    lines: lines.sort((a, b) => a.sortOrder - b.sortOrder).map(toDraft),
  };
}

export async function getClientHistory(clientId: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [jobRows, quoteRows, invoiceRows] = await Promise.all([
    db.select().from(jobs).where(and(eq(jobs.clientId, clientId), eq(jobs.contractorId, contractor.id))),
    db.select().from(quotes).where(and(eq(quotes.clientId, clientId), eq(quotes.contractorId, contractor.id))),
    db.select().from(invoices).where(and(eq(invoices.clientId, clientId), eq(invoices.contractorId, contractor.id))),
  ]);
  return { jobs: jobRows, quotes: quoteRows, invoices: invoiceRows };
}

export async function getLegacyJobDocuments(jobId: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [quoteRows, invoiceRows] = await Promise.all([
    db.select().from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.contractorId, contractor.id))),
    db.select().from(invoices).where(and(eq(invoices.jobId, jobId), eq(invoices.contractorId, contractor.id))),
  ]);
  return { quotes: quoteRows, invoices: invoiceRows };
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

export async function getDocuments(filter: DocumentListFilter = {}, cursor?: string | null, limit = 20) {
  const contractor = await getContractor();
  return getDocumentsForContractor(await ensureDb(), contractor.id, filter, cursor, limit);
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

export async function getDocument(id: string) {
  const contractor = await getContractor();
  return getDocumentForContractor(await ensureDb(), contractor.id, id);
}

export async function getJobDocumentsForContractor(db: Database, contractorId: string, jobId: string) {
  return db.select().from(documents).where(and(eq(documents.jobId, jobId), eq(documents.contractorId, contractorId))).orderBy(desc(documents.updatedAt));
}

export async function getJobDocuments(jobId: string) {
  const contractor = await getContractor();
  return getJobDocumentsForContractor(await ensureDb(), contractor.id, jobId);
}

export async function getTrackedLinesForContractor(db: Database, contractorId: string, jobId: string) {
  return db.select().from(lineItems).where(and(eq(lineItems.jobId, jobId), eq(lineItems.contractorId, contractorId), isNull(lineItems.documentId))).orderBy(lineItems.sortOrder, lineItems.createdAt);
}

export async function getTrackedLines(jobId: string) {
  const contractor = await getContractor();
  return getTrackedLinesForContractor(await ensureDb(), contractor.id, jobId);
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

export async function getHome(today = new Date().toISOString().slice(0, 10)) {
  const contractor = await getContractor();
  return getHomeForContractor(await ensureDb(), contractor.id, today);
}


import { and, desc, eq } from "drizzle-orm";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import {
  clients,
  invoiceLineItems,
  invoices,
  jobs,
  quoteLineItems,
  quotes,
} from "@/lib/db/schema";
import type { DraftLine, LineKind } from "@/lib/money";

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
    .select()
    .from(jobs)
    .where(eq(jobs.contractorId, contractor.id))
    .orderBy(desc(jobs.createdAt));
  const clientRows = await getClients();
  const byId = Object.fromEntries(clientRows.map((c) => [c.id, c]));
  return rows.map((job) => ({ ...job, client: byId[job.clientId] }));
}

export async function getJob(id: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)))
    .limit(1);
  if (!row) return null;
  const client = await getClient(row.clientId);
  return { ...row, client };
}

export async function getQuotes() {
  const contractor = await getContractor();
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(quotes)
    .where(eq(quotes.contractorId, contractor.id))
    .orderBy(desc(quotes.updatedAt));
  const clientRows = await getClients();
  const byId = Object.fromEntries(clientRows.map((c) => [c.id, c]));
  return rows.map((quote) => ({ ...quote, client: byId[quote.clientId] }));
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
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.contractorId, contractor.id)))
    .limit(1);
  if (!row) return null;
  const lines = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, row.id));
  const client = await getClient(row.clientId);
  return {
    ...row,
    client,
    lines: lines.sort((a, b) => a.sortOrder - b.sortOrder).map(toDraft),
  };
}

export async function getInvoices() {
  const contractor = await getContractor();
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.contractorId, contractor.id))
    .orderBy(desc(invoices.updatedAt));
  const clientRows = await getClients();
  const byId = Object.fromEntries(clientRows.map((c) => [c.id, c]));
  return rows.map((invoice) => ({ ...invoice, client: byId[invoice.clientId] }));
}

export async function getInvoice(id: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.contractorId, contractor.id)))
    .limit(1);
  if (!row) return null;
  const lines = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, row.id));
  const client = await getClient(row.clientId);
  return {
    ...row,
    client,
    lines: lines.sort((a, b) => a.sortOrder - b.sortOrder).map(toDraft),
  };
}

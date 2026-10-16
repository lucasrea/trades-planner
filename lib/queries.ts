import { and, desc, eq } from "drizzle-orm";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import {
  clients,
  invoiceLineItems,
  invoices,
  jobs,
  jobCosts,
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

export async function getJobDocuments(jobId: string) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [quoteRows, invoiceRows] = await Promise.all([
    db.select().from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.contractorId, contractor.id))),
    db.select().from(invoices).where(and(eq(invoices.jobId, jobId), eq(invoices.contractorId, contractor.id))),
  ]);
  return { quotes: quoteRows, invoices: invoiceRows };
}


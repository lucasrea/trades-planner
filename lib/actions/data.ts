"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import {
  clients,
  contractors,
  invoiceLineItems,
  invoices,
  jobs,
  quoteLineItems,
  quotes,
} from "@/lib/db/schema";
import {
  computeTotals,
  type DraftLine,
  lineTotal,
  padNumber,
  type LineKind,
} from "@/lib/money";

function id() {
  return crypto.randomUUID();
}

function parseLines(raw: string): DraftLine[] {
  const parsed = JSON.parse(raw) as DraftLine[];
  return parsed.map((line) => ({
    ...line,
    kind: (["material", "labour", "other"].includes(line.kind) ? line.kind : "material") as LineKind,
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    description: String(line.description || ""),
    unit: String(line.unit || "ea"),
  }));
}

export async function saveClientAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const clientId = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Client name is required." };
  const values = {
    name,
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    billingAddress: String(formData.get("billingAddress") || "").trim(),
  };
  if (clientId) {
    await db
      .update(clients)
      .set(values)
      .where(and(eq(clients.id, clientId), eq(clients.contractorId, contractor.id)));
    revalidatePath("/app/clients");
    redirect(`/app/clients/${clientId}`);
  }
  const newId = id();
  await db.insert(clients).values({
    id: newId,
    contractorId: contractor.id,
    createdAt: Date.now(),
    ...values,
  });
  revalidatePath("/app/clients");
  redirect(`/app/clients/${newId}`);
}

export async function saveJobAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const jobId = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  if (!title) return { error: "Job title is required." };
  if (!clientId) return { error: "Pick a client." };
  const values = {
    title,
    clientId,
    status: String(formData.get("status") || "quoted"),
    siteAddress: String(formData.get("siteAddress") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    targetDate: String(formData.get("targetDate") || "") || null,
  };
  if (jobId) {
    await db
      .update(jobs)
      .set(values)
      .where(and(eq(jobs.id, jobId), eq(jobs.contractorId, contractor.id)));
    revalidatePath("/app/jobs");
    redirect(`/app/jobs/${jobId}`);
  }
  const newId = id();
  await db.insert(jobs).values({
    id: newId,
    contractorId: contractor.id,
    createdAt: Date.now(),
    ...values,
  });
  revalidatePath("/app/jobs");
  redirect(`/app/jobs/${newId}`);
}

export async function saveQuoteAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const quoteId = String(formData.get("id") || "") || id();
  const isNew = !String(formData.get("id") || "");
  const clientId = String(formData.get("clientId") || "");
  if (!clientId) return { error: "Pick a client." };
  const lines = parseLines(String(formData.get("lines") || "[]"));
  const totals = computeTotals(lines, contractor.taxRate);
  const now = Date.now();
  const jobId = String(formData.get("jobId") || "") || null;

  if (isNew) {
    const number = padNumber(contractor.nextQuoteNumber, "Q");
    await db.insert(quotes).values({
      id: quoteId,
      contractorId: contractor.id,
      clientId,
      jobId,
      quoteNumber: number,
      status: String(formData.get("status") || "draft"),
      notes: String(formData.get("notes") || ""),
      validUntil: String(formData.get("validUntil") || "") || null,
      ...totals,
      createdAt: now,
      updatedAt: now,
    });
    await db
      .update(contractors)
      .set({ nextQuoteNumber: contractor.nextQuoteNumber + 1 })
      .where(eq(contractors.id, contractor.id));
  } else {
    await db
      .update(quotes)
      .set({
        clientId,
        jobId,
        status: String(formData.get("status") || "draft"),
        notes: String(formData.get("notes") || ""),
        validUntil: String(formData.get("validUntil") || "") || null,
        ...totals,
        updatedAt: now,
      })
      .where(and(eq(quotes.id, quoteId), eq(quotes.contractorId, contractor.id)));
    await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  }

  if (lines.length) {
    await db.insert(quoteLineItems).values(
      lines.map((line, index) => ({
        id: line.id || id(),
        quoteId,
        sortOrder: index,
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        lineTotal: lineTotal(line),
      })),
    );
  }

  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${quoteId}`);
}

export async function saveInvoiceAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const invoiceId = String(formData.get("id") || "") || id();
  const isNew = !String(formData.get("id") || "");
  const clientId = String(formData.get("clientId") || "");
  if (!clientId) return { error: "Pick a client." };
  const lines = parseLines(String(formData.get("lines") || "[]"));
  const totals = computeTotals(lines, contractor.taxRate);
  const now = Date.now();
  const jobId = String(formData.get("jobId") || "") || null;
  const quoteId = String(formData.get("quoteId") || "") || null;

  if (isNew) {
    const number = padNumber(contractor.nextInvoiceNumber, "INV");
    await db.insert(invoices).values({
      id: invoiceId,
      contractorId: contractor.id,
      clientId,
      jobId,
      quoteId,
      invoiceNumber: number,
      status: String(formData.get("status") || "draft"),
      notes: String(formData.get("notes") || ""),
      dueDate: String(formData.get("dueDate") || "") || null,
      ...totals,
      createdAt: now,
      updatedAt: now,
    });
    await db
      .update(contractors)
      .set({ nextInvoiceNumber: contractor.nextInvoiceNumber + 1 })
      .where(eq(contractors.id, contractor.id));
  } else {
    await db
      .update(invoices)
      .set({
        clientId,
        jobId,
        status: String(formData.get("status") || "draft"),
        notes: String(formData.get("notes") || ""),
        dueDate: String(formData.get("dueDate") || "") || null,
        ...totals,
        updatedAt: now,
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.contractorId, contractor.id)));
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  if (lines.length) {
    await db.insert(invoiceLineItems).values(
      lines.map((line, index) => ({
        id: line.id || id(),
        invoiceId,
        sortOrder: index,
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        lineTotal: lineTotal(line),
      })),
    );
  }

  revalidatePath("/app/invoices");
  redirect(`/app/invoices/${invoiceId}`);
}

export async function invoiceFromQuoteAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") || "");
  const contractor = await getContractor();
  const db = await ensureDb();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.contractorId, contractor.id)))
    .limit(1);
  if (!quote) throw new Error("Quote not found.");
  const lines = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, quote.id));
  const now = Date.now();
  const invoiceId = id();
  const number = padNumber(contractor.nextInvoiceNumber, "INV");
  await db.insert(invoices).values({
    id: invoiceId,
    contractorId: contractor.id,
    clientId: quote.clientId,
    jobId: quote.jobId,
    quoteId: quote.id,
    invoiceNumber: number,
    status: "draft",
    notes: quote.notes,
    subtotal: quote.subtotal,
    tax: quote.tax,
    total: quote.total,
    createdAt: now,
    updatedAt: now,
  });
  if (lines.length) {
    await db.insert(invoiceLineItems).values(
      lines.map((line, index) => ({
        id: id(),
        invoiceId,
        sortOrder: index,
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
    );
  }
  await db
    .update(contractors)
    .set({ nextInvoiceNumber: contractor.nextInvoiceNumber + 1 })
    .where(eq(contractors.id, contractor.id));
  redirect(`/app/invoices/${invoiceId}`);
}

export async function listDashboard() {
  const contractor = await getContractor();
  const db = await ensureDb();
  const [clientRows, jobRows, quoteRows, invoiceRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.contractorId, contractor.id)).orderBy(desc(clients.createdAt)),
    db.select().from(jobs).where(eq(jobs.contractorId, contractor.id)).orderBy(desc(jobs.createdAt)),
    db.select().from(quotes).where(eq(quotes.contractorId, contractor.id)).orderBy(desc(quotes.updatedAt)),
    db.select().from(invoices).where(eq(invoices.contractorId, contractor.id)).orderBy(desc(invoices.updatedAt)),
  ]);
  return {
    contractor,
    clients: clientRows,
    jobs: jobRows,
    quotes: quoteRows,
    invoices: invoiceRows,
  };
}

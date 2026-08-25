"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContractor } from "@/lib/auth";
import { ensureDb, type Database } from "@/lib/db";
import {
  formEnum,
  formOptionalText,
  formText,
  parseDraftLines,
} from "@/lib/actions/form-data";
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
  lineTotal,
  padNumber,
} from "@/lib/money";

const jobStatuses = ["quoted", "active", "completed", "archived"] as const;
const quoteStatuses = ["draft", "sent", "approved", "declined"] as const;
const invoiceStatuses = ["draft", "sent", "paid", "overdue"] as const;

function id() {
  return crypto.randomUUID();
}

async function ownsClient(db: Database, contractorId: string, clientId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.contractorId, contractorId)))
    .limit(1);
  return Boolean(client);
}

async function ownsJobForClient(
  db: Database,
  contractorId: string,
  clientId: string,
  jobId: string | null,
) {
  if (!jobId) return true;
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.clientId, clientId),
        eq(jobs.contractorId, contractorId),
      ),
    )
    .limit(1);
  return Boolean(job);
}

export async function saveClientAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const clientId = formText(formData, "id");
  const name = formText(formData, "name");
  if (!name) return { error: "Client name is required." };
  const values = {
    name,
    email: formText(formData, "email"),
    phone: formText(formData, "phone"),
    billingAddress: formText(formData, "billingAddress"),
  };
  if (clientId) {
    const [updated] = await db
      .update(clients)
      .set(values)
      .where(and(eq(clients.id, clientId), eq(clients.contractorId, contractor.id)))
      .returning({ id: clients.id });
    if (!updated) return { error: "Client not found." };
    revalidatePath("/app/clients");
    revalidatePath(`/app/clients/${clientId}`);
    revalidatePath("/app");
    return { redirectTo: "/app/clients" };
  }
  const newId = id();
  await db.insert(clients).values({
    id: newId,
    contractorId: contractor.id,
    createdAt: Date.now(),
    ...values,
  });
  revalidatePath("/app/clients");
  revalidatePath("/app");
  return { redirectTo: "/app/clients" };
}

export async function saveJobAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const jobId = formText(formData, "id");
  const title = formText(formData, "title");
  const clientId = formText(formData, "clientId");
  if (!title) return { error: "Job title is required." };
  if (!clientId) return { error: "Pick a client." };
  if (!(await ownsClient(db, contractor.id, clientId))) {
    return { error: "Client not found." };
  }
  const values = {
    title,
    clientId,
    status: formEnum(formData, "status", jobStatuses, "quoted"),
    siteAddress: formText(formData, "siteAddress"),
    notes: formText(formData, "notes"),
    targetDate: formOptionalText(formData, "targetDate"),
  };
  if (jobId) {
    const [updated] = await db
      .update(jobs)
      .set(values)
      .where(and(eq(jobs.id, jobId), eq(jobs.contractorId, contractor.id)))
      .returning({ id: jobs.id });
    if (!updated) return { error: "Job not found." };
    revalidatePath("/app/jobs");
    revalidatePath(`/app/jobs/${jobId}`);
    revalidatePath("/app");
    return { redirectTo: "/app/jobs" };
  }
  const newId = id();
  await db.insert(jobs).values({
    id: newId,
    contractorId: contractor.id,
    createdAt: Date.now(),
    ...values,
  });
  revalidatePath("/app/jobs");
  revalidatePath("/app");
  return { redirectTo: "/app/jobs" };
}

export async function saveQuoteAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const existingId = formText(formData, "id");
  const quoteId = existingId || id();
  const isNew = !existingId;
  const clientId = formText(formData, "clientId");
  if (!clientId) return { error: "Pick a client." };
  if (!(await ownsClient(db, contractor.id, clientId))) {
    return { error: "Client not found." };
  }
  const lines = parseDraftLines(formData.get("lines"));
  const totals = computeTotals(lines, contractor.taxRate);
  const now = Date.now();
  const jobId = formOptionalText(formData, "jobId");
  if (!(await ownsJobForClient(db, contractor.id, clientId, jobId))) {
    return { error: "Job not found for this client." };
  }
  if (!isNew) {
    const [existingQuote] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.contractorId, contractor.id)))
      .limit(1);
    if (!existingQuote) return { error: "Quote not found." };
  }

  await db.transaction(async (tx) => {
    if (isNew) {
      const [counter] = await tx
        .update(contractors)
        .set({ nextQuoteNumber: sql`${contractors.nextQuoteNumber} + 1` })
        .where(eq(contractors.id, contractor.id))
        .returning({ next: contractors.nextQuoteNumber });
      if (!counter) throw new Error("Contractor not found.");
      await tx.insert(quotes).values({
        id: quoteId,
        contractorId: contractor.id,
        clientId,
        jobId,
        quoteNumber: padNumber(counter.next - 1, "Q"),
        status: formEnum(formData, "status", quoteStatuses, "draft"),
        notes: formText(formData, "notes"),
        validUntil: formOptionalText(formData, "validUntil"),
        ...totals,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await tx
        .update(quotes)
        .set({
          clientId,
          jobId,
          status: formEnum(formData, "status", quoteStatuses, "draft"),
          notes: formText(formData, "notes"),
          validUntil: formOptionalText(formData, "validUntil"),
          ...totals,
          updatedAt: now,
        })
        .where(and(eq(quotes.id, quoteId), eq(quotes.contractorId, contractor.id)));
      await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
    }

    if (lines.length) {
      await tx.insert(quoteLineItems).values(
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
  });

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app");
  return { redirectTo: isNew ? `/app/quotes/${quoteId}` : "/app/quotes" };
}

export async function saveInvoiceAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const db = await ensureDb();
  const existingId = formText(formData, "id");
  const invoiceId = existingId || id();
  const isNew = !existingId;
  const clientId = formText(formData, "clientId");
  if (!clientId) return { error: "Pick a client." };
  if (!(await ownsClient(db, contractor.id, clientId))) {
    return { error: "Client not found." };
  }
  const lines = parseDraftLines(formData.get("lines"));
  const totals = computeTotals(lines, contractor.taxRate);
  const now = Date.now();
  const jobId = formOptionalText(formData, "jobId");
  const quoteId = formOptionalText(formData, "quoteId");
  if (!(await ownsJobForClient(db, contractor.id, clientId, jobId))) {
    return { error: "Job not found for this client." };
  }
  if (quoteId) {
    const [sourceQuote] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          eq(quotes.id, quoteId),
          eq(quotes.clientId, clientId),
          eq(quotes.contractorId, contractor.id),
        ),
      )
      .limit(1);
    if (!sourceQuote) return { error: "Source quote not found." };
  }
  if (!isNew) {
    const [existingInvoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.contractorId, contractor.id)))
      .limit(1);
    if (!existingInvoice) return { error: "Invoice not found." };
  }

  await db.transaction(async (tx) => {
    if (isNew) {
      const [counter] = await tx
        .update(contractors)
        .set({ nextInvoiceNumber: sql`${contractors.nextInvoiceNumber} + 1` })
        .where(eq(contractors.id, contractor.id))
        .returning({ next: contractors.nextInvoiceNumber });
      if (!counter) throw new Error("Contractor not found.");
      await tx.insert(invoices).values({
        id: invoiceId,
        contractorId: contractor.id,
        clientId,
        jobId,
        quoteId,
        invoiceNumber: padNumber(counter.next - 1, "INV"),
        status: formEnum(formData, "status", invoiceStatuses, "draft"),
        notes: formText(formData, "notes"),
        dueDate: formOptionalText(formData, "dueDate"),
        ...totals,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await tx
        .update(invoices)
        .set({
          clientId,
          jobId,
          status: formEnum(formData, "status", invoiceStatuses, "draft"),
          notes: formText(formData, "notes"),
          dueDate: formOptionalText(formData, "dueDate"),
          ...totals,
          updatedAt: now,
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.contractorId, contractor.id)));
      await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
    }

    if (lines.length) {
      await tx.insert(invoiceLineItems).values(
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
  });

  revalidatePath("/app/invoices");
  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath("/app");
  return { redirectTo: isNew ? `/app/invoices/${invoiceId}` : "/app/invoices" };
}

export async function invoiceFromQuoteAction(formData: FormData) {
  const quoteId = formText(formData, "quoteId");
  const contractor = await getContractor();
  const db = await ensureDb();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.contractorId, contractor.id)))
    .limit(1);
  if (!quote) throw new Error("Quote not found.");
  const [existingInvoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.quoteId, quote.id),
        eq(invoices.contractorId, contractor.id),
      ),
    )
    .limit(1);
  if (existingInvoice) redirect(`/app/invoices/${existingInvoice.id}`);

  const lines = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, quote.id));
  const now = Date.now();
  const invoiceId = id();
  await db.transaction(async (tx) => {
    const [counter] = await tx
      .update(contractors)
      .set({ nextInvoiceNumber: sql`${contractors.nextInvoiceNumber} + 1` })
      .where(eq(contractors.id, contractor.id))
      .returning({ next: contractors.nextInvoiceNumber });
    if (!counter) throw new Error("Contractor not found.");
    await tx.insert(invoices).values({
      id: invoiceId,
      contractorId: contractor.id,
      clientId: quote.clientId,
      jobId: quote.jobId,
      quoteId: quote.id,
      invoiceNumber: padNumber(counter.next - 1, "INV"),
      status: "draft",
      notes: quote.notes,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      createdAt: now,
      updatedAt: now,
    });
    if (lines.length) {
      await tx.insert(invoiceLineItems).values(
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
  });
  revalidatePath("/app/invoices");
  revalidatePath("/app/quotes");
  revalidatePath("/app");
  redirect(`/app/invoices/${invoiceId}`);
}

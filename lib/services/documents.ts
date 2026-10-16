import { and, eq, isNull } from "drizzle-orm";
import {
  canTransition,
  defaultDueDate,
  defaultValidUntil,
  documentNumber,
  isLocked,
  type DocStatus,
  type DocType,
} from "@/lib/documents";
import { contractors, documents, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { ConflictError, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import {
  lockContractorForNumbering,
  nextDocumentSortOrder,
  recomputeDocumentTotals,
  requireDocument,
  requireJob,
  touchJob,
} from "@/lib/services/internal";

type Tx = Parameters<Parameters<ServiceContext["db"]["transaction"]>[0]>[0];

async function insertDraft(tx: Tx, ctx: ServiceContext, jobId: string, type: DocType, extra: Partial<typeof documents.$inferInsert> = {}) {
  const job = await requireJob(tx, ctx.contractorId, jobId);
  const now = Date.now();
  await lockContractorForNumbering(tx, ctx.contractorId);
  const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, ctx.contractorId)).limit(1);
  if (!contractor) throw new NotFoundError("Contractor not found.");
  const isQuote = type === "quote";
  const current = isQuote ? contractor.nextQuoteNumber : contractor.nextInvoiceNumber;
  const number = documentNumber(type, current);
  await tx.update(contractors).set(isQuote ? { nextQuoteNumber: current + 1 } : { nextInvoiceNumber: current + 1 }).where(eq(contractors.id, ctx.contractorId));
  const id = newId();
  const date = new Date(now);
  await tx.insert(documents).values({
    id,
    contractorId: ctx.contractorId,
    clientId: job.clientId,
    jobId: job.id,
    type,
    number,
    status: "draft",
    notes: "",
    validUntil: isQuote ? defaultValidUntil(date) : null,
    dueDate: isQuote ? null : defaultDueDate(date),
    sourceQuoteId: null,
    subtotal: 0,
    tax: 0,
    total: 0,
    sentAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
  await touchJob(tx, ctx.contractorId, job.id);
  return { id, number };
}

export async function createDraftDocument(ctx: ServiceContext, jobId: string, type: DocType) {
  return ctx.db.transaction(async (tx) => insertDraft(tx, ctx, jobId, type));
}

export async function saveDocumentMeta(ctx: ServiceContext, input: { documentId: string; notes?: string; validUntil?: string | null; dueDate?: string | null }) {
  const doc = await requireDocument(ctx.db, ctx.contractorId, input.documentId);
  if (isLocked(doc.status as DocStatus)) throw new ConflictError("Document is locked.");
  await ctx.db.update(documents).set({
    notes: input.notes?.trim() ?? doc.notes,
    validUntil: input.validUntil === undefined ? doc.validUntil : input.validUntil,
    dueDate: input.dueDate === undefined ? doc.dueDate : input.dueDate,
    updatedAt: Date.now(),
  }).where(and(eq(documents.id, doc.id), eq(documents.contractorId, ctx.contractorId)));
}

export async function setDocumentStatus(ctx: ServiceContext, documentId: string, next: DocStatus) {
  const doc = await requireDocument(ctx.db, ctx.contractorId, documentId);
  if (!canTransition(doc.type as DocType, doc.status as DocStatus, next)) throw new ValidationError("Invalid status transition.");
  const now = Date.now();
  await ctx.db.transaction(async (tx) => {
    await tx.update(documents).set({
      status: next,
      sentAt: next === "sent" ? now : doc.sentAt,
      closedAt: next === "approved" || next === "declined" || next === "paid" ? now : doc.closedAt,
      updatedAt: now,
    }).where(and(eq(documents.id, documentId), eq(documents.contractorId, ctx.contractorId)));
    if (doc.type === "quote" && next === "approved") {
      await tx.update(jobs).set({ status: "active", updatedAt: now }).where(and(eq(jobs.id, doc.jobId), eq(jobs.contractorId, ctx.contractorId), eq(jobs.status, "quoted")));
    }
  });
}

export async function deleteDraftDocument(ctx: ServiceContext, documentId: string) {
  const doc = await requireDocument(ctx.db, ctx.contractorId, documentId);
  if (isLocked(doc.status as DocStatus)) throw new ConflictError("Document is locked.");
  await ctx.db.transaction(async (tx) => {
    if (doc.type === "invoice") {
      await tx.update(lineItems).set({ billedDocumentId: null }).where(and(eq(lineItems.billedDocumentId, documentId), eq(lineItems.contractorId, ctx.contractorId)));
    }
    await tx.delete(lineItems).where(and(eq(lineItems.documentId, documentId), eq(lineItems.contractorId, ctx.contractorId)));
    await tx.delete(documents).where(and(eq(documents.id, documentId), eq(documents.contractorId, ctx.contractorId)));
    await touchJob(tx, ctx.contractorId, doc.jobId);
  });
}

export async function getDocumentWithLines(ctx: ServiceContext, documentId: string) {
  const doc = await requireDocument(ctx.db, ctx.contractorId, documentId);
  const lines = await ctx.db.select().from(lineItems).where(and(eq(lineItems.documentId, documentId), eq(lineItems.contractorId, ctx.contractorId)));
  return { document: doc, lines: lines.slice().sort((a, b) => a.sortOrder - b.sortOrder) };
}

async function selectUnbilledTrackedForUpdate(tx: Tx, ctx: ServiceContext, jobId: string) {
  return tx.select().from(lineItems).where(and(eq(lineItems.contractorId, ctx.contractorId), eq(lineItems.jobId, jobId), isNull(lineItems.documentId), isNull(lineItems.billedDocumentId))).for("update");
}

async function copyTrackedLinesToInvoice(tx: Tx, ctx: ServiceContext, invoiceId: string, jobId: string, trackedRows: (typeof lineItems.$inferSelect)[]) {
  const doc = await requireDocument(tx, ctx.contractorId, invoiceId);
  if (doc.type !== "invoice" || isLocked(doc.status as DocStatus)) throw new ConflictError("Invoice is not an editable draft.");
  let sortOrder = (await nextDocumentSortOrder(tx, ctx.contractorId, invoiceId)) - 1;
  const now = Date.now();
  for (const tracked of trackedRows) {
    sortOrder += 1;
    await tx.insert(lineItems).values({ id: newId(), contractorId: ctx.contractorId, jobId: tracked.jobId, documentId: invoiceId, billedDocumentId: null, captureId: tracked.captureId, sortOrder, kind: tracked.kind, description: tracked.description, quantity: tracked.quantity, unit: tracked.unit, unitCost: tracked.unitCost, unitPrice: tracked.unitPrice, lineTotal: tracked.lineTotal, createdAt: now });
    await tx.update(lineItems).set({ billedDocumentId: invoiceId }).where(and(eq(lineItems.id, tracked.id), eq(lineItems.contractorId, ctx.contractorId)));
  }
  await recomputeDocumentTotals(tx, ctx.contractorId, invoiceId);
  await touchJob(tx, ctx.contractorId, jobId);
}

export async function createInvoiceFromQuote(ctx: ServiceContext, quoteId: string) {
  const quote = await requireDocument(ctx.db, ctx.contractorId, quoteId);
  if (quote.type !== "quote") throw new ValidationError("Document is not a quote.");
  if (quote.status !== "approved") throw new ValidationError("Quote must be approved.");
  const [existing] = await ctx.db.select({ id: documents.id }).from(documents).where(and(eq(documents.sourceQuoteId, quoteId), eq(documents.contractorId, ctx.contractorId), eq(documents.type, "invoice"))).limit(1);
  if (existing) return existing.id;
  const quoteLines = await ctx.db.select().from(lineItems).where(and(eq(lineItems.documentId, quoteId), eq(lineItems.contractorId, ctx.contractorId)));
  return ctx.db.transaction(async (tx) => {
    const { id: invoiceId } = await insertDraft(tx, ctx, quote.jobId, "invoice", { notes: quote.notes, dueDate: defaultDueDate(new Date()), sourceQuoteId: quote.id, subtotal: quote.subtotal, tax: quote.tax, total: quote.total });
    if (quoteLines.length) {
      const now = Date.now();
      await tx.insert(lineItems).values(quoteLines.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((line, index) => ({ id: newId(), contractorId: ctx.contractorId, jobId: quote.jobId, documentId: invoiceId, billedDocumentId: null, captureId: null, sortOrder: index, kind: line.kind, description: line.description, quantity: line.quantity, unit: line.unit, unitCost: line.unitCost, unitPrice: line.unitPrice, lineTotal: line.lineTotal, createdAt: now })));
    }
    return invoiceId;
  });
}

export async function createInvoiceFromTrackedLines(ctx: ServiceContext, jobId: string) {
  await requireJob(ctx.db, ctx.contractorId, jobId);
  return ctx.db.transaction(async (tx) => {
    const rows = await selectUnbilledTrackedForUpdate(tx, ctx, jobId);
    if (!rows.length) throw new ValidationError("No unbilled tracked lines on this job.");
    const { id: invoiceId } = await insertDraft(tx, ctx, jobId, "invoice");
    await copyTrackedLinesToInvoice(tx, ctx, invoiceId, jobId, rows);
    return invoiceId;
  });
}

export async function addTrackedLinesToInvoice(ctx: ServiceContext, invoiceId: string) {
  const invoice = await requireDocument(ctx.db, ctx.contractorId, invoiceId);
  if (invoice.type !== "invoice" || isLocked(invoice.status as DocStatus)) throw new ConflictError("Invoice is not an editable draft.");
  return ctx.db.transaction(async (tx) => {
    const rows = await selectUnbilledTrackedForUpdate(tx, ctx, invoice.jobId);
    if (!rows.length) throw new ValidationError("No unbilled tracked lines on this job.");
    await copyTrackedLinesToInvoice(tx, ctx, invoiceId, invoice.jobId, rows);
    return invoiceId;
  });
}

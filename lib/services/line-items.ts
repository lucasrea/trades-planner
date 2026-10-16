import { and, eq, isNull, max } from "drizzle-orm";
import { isLocked, type DocStatus } from "@/lib/documents";
import { lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { toLineRow, validateLine, type LineInput } from "@/lib/line-items";
import { ConflictError, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import { nextDocumentSortOrder, recomputeDocumentTotals, requireDocument, requireJob, touchJob } from "@/lib/services/internal";

type SaveLineInput = LineInput & { id?: string; jobId: string; documentId?: string | null };

export async function saveTrackedLine(ctx: ServiceContext, input: SaveLineInput) {
  return saveLine(ctx, { ...input, documentId: null });
}

export async function saveDocumentLine(ctx: ServiceContext, input: SaveLineInput & { documentId: string }) {
  return saveLine(ctx, input);
}

async function saveLine(ctx: ServiceContext, input: SaveLineInput) {
  const errors = validateLine({ ...input, unitPrice: input.unitPrice });
  if (errors.length) throw new ValidationError(errors[0]!);
  await requireJob(ctx.db, ctx.contractorId, input.jobId);
  const row = toLineRow({ ...input, unitPrice: input.unitPrice! });
  if (input.documentId) {
    const doc = await requireDocument(ctx.db, ctx.contractorId, input.documentId);
    if (doc.jobId !== input.jobId) throw new ValidationError("Line job does not match document job.");
    if (isLocked(doc.status as DocStatus)) throw new ConflictError("Document is locked.");
  }
  if (input.id) {
    const [existing] = await ctx.db.select().from(lineItems).where(and(eq(lineItems.id, input.id), eq(lineItems.contractorId, ctx.contractorId))).limit(1);
    if (!existing) throw new NotFoundError("Line not found.");
    if (input.jobId !== existing.jobId) throw new ValidationError("Line job does not match.");
    if (existing.documentId) {
      const doc = await requireDocument(ctx.db, ctx.contractorId, existing.documentId);
      if (doc.jobId !== input.jobId) throw new ValidationError("Line job does not match document job.");
      if (isLocked(doc.status as DocStatus)) throw new ConflictError("Document is locked.");
    } else if (existing.billedDocumentId) throw new ConflictError("Billed tracked line cannot be edited.");
    await ctx.db.transaction(async (tx) => {
      await tx.update(lineItems).set({ kind: input.kind, description: row.description, quantity: row.quantity, unit: row.unit, unitCost: input.unitCost ?? existing.unitCost, unitPrice: row.unitPrice, lineTotal: row.lineTotal }).where(and(eq(lineItems.id, input.id!), eq(lineItems.contractorId, ctx.contractorId)));
      if (existing.documentId) await recomputeDocumentTotals(tx, ctx.contractorId, existing.documentId);
      await touchJob(tx, ctx.contractorId, existing.jobId);
    });
    return input.id;
  }
  return ctx.db.transaction(async (tx) => {
    const sortOrder = input.documentId
      ? await nextDocumentSortOrder(tx, ctx.contractorId, input.documentId)
      : (((await tx.select({ value: max(lineItems.sortOrder) }).from(lineItems).where(and(eq(lineItems.jobId, input.jobId), eq(lineItems.contractorId, ctx.contractorId), isNull(lineItems.documentId))))[0]?.value ?? -1) + 1);
    const id = newId();
    const now = Date.now();
    await tx.insert(lineItems).values({ id, contractorId: ctx.contractorId, jobId: input.jobId, documentId: input.documentId ?? null, billedDocumentId: null, captureId: null, sortOrder, kind: input.kind, description: row.description, quantity: row.quantity, unit: row.unit, unitCost: input.unitCost ?? null, unitPrice: row.unitPrice, lineTotal: row.lineTotal, createdAt: now });
    if (input.documentId) await recomputeDocumentTotals(tx, ctx.contractorId, input.documentId);
    await touchJob(tx, ctx.contractorId, input.jobId);
    return id;
  });
}

export async function deleteLine(ctx: ServiceContext, lineId: string) {
  const [existing] = await ctx.db.select().from(lineItems).where(and(eq(lineItems.id, lineId), eq(lineItems.contractorId, ctx.contractorId))).limit(1);
  if (!existing) throw new NotFoundError("Line not found.");
  if (existing.documentId) {
    const doc = await requireDocument(ctx.db, ctx.contractorId, existing.documentId);
    if (isLocked(doc.status as DocStatus)) throw new ConflictError("Document is locked.");
  } else if (existing.billedDocumentId) throw new ConflictError("Billed tracked line cannot be deleted.");
  await ctx.db.transaction(async (tx) => {
    await tx.delete(lineItems).where(and(eq(lineItems.id, lineId), eq(lineItems.contractorId, ctx.contractorId)));
    if (existing.documentId) await recomputeDocumentTotals(tx, ctx.contractorId, existing.documentId);
    await touchJob(tx, ctx.contractorId, existing.jobId);
  });
}

import { and, eq, max } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { contractors, documents, jobs, lineItems } from "@/lib/db/schema";
import { documentTotals, type DraftLine, type LineKind } from "@/lib/money";
import { NotFoundError } from "@/lib/services/context";

type DbLike = Database;

export async function getTaxRate(db: DbLike, contractorId: string) {
  const [row] = await db.select({ taxRate: contractors.taxRate }).from(contractors).where(eq(contractors.id, contractorId)).limit(1);
  if (!row) throw new NotFoundError("Contractor not found.");
  return row.taxRate;
}

export async function touchJob(db: DbLike, contractorId: string, jobId: string) {
  await db.update(jobs).set({ updatedAt: Date.now() }).where(and(eq(jobs.id, jobId), eq(jobs.contractorId, contractorId)));
}

export async function requireJob(db: DbLike, contractorId: string, jobId: string) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.contractorId, contractorId))).limit(1);
  if (!job) throw new NotFoundError("Job not found.");
  return job;
}

export async function requireDocument(db: DbLike, contractorId: string, documentId: string) {
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.contractorId, contractorId))).limit(1);
  if (!doc) throw new NotFoundError("Document not found.");
  return doc;
}

function toDraftLine(line: { id: string; kind: string; description: string; quantity: number; unit: string; unitPrice: number }): DraftLine {
  return { id: line.id, kind: line.kind as LineKind, description: line.description, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice };
}

export async function recomputeDocumentTotals(db: DbLike, contractorId: string, documentId: string) {
  const taxRate = await getTaxRate(db, contractorId);
  const lines = await db.select().from(lineItems).where(and(eq(lineItems.documentId, documentId), eq(lineItems.contractorId, contractorId)));
  const totals = documentTotals(lines.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(toDraftLine), taxRate);
  await db.update(documents).set({ ...totals, updatedAt: Date.now() }).where(and(eq(documents.id, documentId), eq(documents.contractorId, contractorId)));
  return totals;
}

export async function nextDocumentSortOrder(db: DbLike, contractorId: string, documentId: string) {
  const [row] = await db.select({ value: max(lineItems.sortOrder) }).from(lineItems).where(and(eq(lineItems.documentId, documentId), eq(lineItems.contractorId, contractorId)));
  return (row?.value ?? -1) + 1;
}

export async function lockContractorForNumbering(db: DbLike, contractorId: string) {
  await db.select({ id: contractors.id }).from(contractors).where(eq(contractors.id, contractorId)).for("update");
}

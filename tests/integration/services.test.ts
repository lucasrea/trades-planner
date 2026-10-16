import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { documents, lineItems } from "@/lib/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { getClient, saveClient } from "@/lib/services/clients";
import { createDraftDocument, createInvoiceFromQuote, createInvoiceFromTrackedLines, deleteDraftDocument, setDocumentStatus } from "@/lib/services/documents";
import { createJobWithClient } from "@/lib/services/jobs";
import { saveDocumentLine, saveTrackedLine } from "@/lib/services/line-items";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";

describe("services", () => {
  it("isolates tenants", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    await expect(saveClient({ db, contractorId: a.contractorId }, { id: b.clientId, name: "X" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getClient({ db, contractorId: a.contractorId }, b.clientId)).resolves.toBeNull();
  });

  it("allocates unique numbers concurrently", async () => {
    const tenant = await seedTenant("n");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const docs = await Promise.all(Array.from({ length: 50 }, () => createDraftDocument(ctx, tenant.jobId, "quote")));
    expect(new Set(docs.map((d) => d.number)).size).toBe(50);
  });

  it("bills and releases tracked lines", async () => {
    const tenant = await seedTenant("b");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    await saveTrackedLine(ctx, { jobId: tenant.jobId, kind: "material", description: "Part", quantity: 1, unit: "ea", unitPrice: 10 });
    const invoiceId = await createInvoiceFromTrackedLines(ctx, tenant.jobId);
    await deleteDraftDocument(ctx, invoiceId);
    const tracked = await ctx.db.select().from(lineItems).where(and(eq(lineItems.jobId, tenant.jobId), isNull(lineItems.documentId)));
    expect(tracked.every((l) => l.billedDocumentId == null)).toBe(true);
  });

  it("locks sent documents", async () => {
    const tenant = await seedTenant("l");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const { id } = await createDraftDocument(ctx, tenant.jobId, "quote");
    await setDocumentStatus(ctx, id, "sent");
    await expect(saveDocumentLine(ctx, { jobId: tenant.jobId, documentId: id, kind: "labour", description: "X", quantity: 1, unit: "hr", unitPrice: 1 })).rejects.toThrow(/locked/i);
  });

  it("creates invoice from approved quote once", async () => {
    const tenant = await seedTenant("q");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const { id } = await createDraftDocument(ctx, tenant.jobId, "quote");
    await setDocumentStatus(ctx, id, "sent");
    await setDocumentStatus(ctx, id, "approved");
    const first = await createInvoiceFromQuote(ctx, id);
    const second = await createInvoiceFromQuote(ctx, id);
    expect(first).toBe(second);
  });

  it("creates job with inline client", async () => {
    const tenant = await seedTenant("j");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    await createJobWithClient(ctx, { title: "New", client: { name: "Inline" } });
    expect(await createJobWithClient(ctx, { title: "Again", client: { id: tenant.clientId } })).toBeTruthy();
  });

  it("rejects document line with mismatched job", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const ctxA = { db, contractorId: a.contractorId };
    const { id: quoteId } = await createDraftDocument(ctxA, a.jobId, "quote");
    await expect(
      saveDocumentLine(ctxA, {
        jobId: b.jobId,
        documentId: quoteId,
        kind: "material",
        description: "X",
        quantity: 1,
        unit: "ea",
        unitPrice: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("createInvoiceFromQuote is idempotent under parallel calls", async () => {
    const tenant = await seedTenant("pq");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const { id: quoteId } = await createDraftDocument(ctx, tenant.jobId, "quote");
    await saveDocumentLine(ctx, {
      jobId: tenant.jobId,
      documentId: quoteId,
      kind: "labour",
      description: "Work",
      quantity: 1,
      unit: "hr",
      unitPrice: 50,
    });
    await setDocumentStatus(ctx, quoteId, "sent");
    await setDocumentStatus(ctx, quoteId, "approved");
    const ids = await Promise.all([
      createInvoiceFromQuote(ctx, quoteId),
      createInvoiceFromQuote(ctx, quoteId),
    ]);
    expect(ids[0]).toBe(ids[1]);
    const invoices = await ctx.db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.sourceQuoteId, quoteId),
          eq(documents.contractorId, ctx.contractorId),
          eq(documents.type, "invoice"),
        ),
      );
    expect(invoices).toHaveLength(1);
  });

  it("deleteLine rejects locked documents", async () => {
    const tenant = await seedTenant("dl");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const { id } = await createDraftDocument(ctx, tenant.jobId, "quote");
    const lineId = await saveDocumentLine(ctx, {
      jobId: tenant.jobId,
      documentId: id,
      kind: "labour",
      description: "X",
      quantity: 1,
      unit: "hr",
      unitPrice: 1,
    });
    await setDocumentStatus(ctx, id, "sent");
    const { deleteLine } = await import("@/lib/services/line-items");
    await expect(deleteLine(ctx, lineId)).rejects.toBeInstanceOf(ConflictError);
  });
});

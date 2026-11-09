import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { documentLinks, documents, jobs, lineItems } from "@/lib/db/schema";
import { SHARE_ATTEMPT_MAX } from "@/lib/share-attempt-window";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { SHARE_ATTEMPT_LIMIT_MESSAGE } from "@/lib/services/document-links";
import { createDraftDocument, deleteDraftDocument, setDocumentStatus } from "@/lib/services/documents";
import {
  createDocumentLink,
  getActiveLinkToken,
  getSharedDocument,
  respondToSharedQuote,
  revokeDocumentLink,
} from "@/lib/services/document-links";
import { saveDocumentLine } from "@/lib/services/line-items";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";

async function draftQuote(label: string) {
  const tenant = await seedTenant(label);
  const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
  const { id } = await createDraftDocument(ctx, tenant.jobId, "quote");
  await saveDocumentLine(ctx, { jobId: tenant.jobId, documentId: id, kind: "labour", description: "Work", quantity: 2, unit: "hr", unitPrice: 50 });
  return { tenant, ctx, id };
}

describe("document links", () => {
  it("creates one active link per document and shows the stored totals", async () => {
    const { ctx, id } = await draftQuote("l1");
    const token = await createDocumentLink(ctx, id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await createDocumentLink(ctx, id)).toBe(token);
    expect(await getActiveLinkToken(ctx, id)).toBe(token);

    const shared = await getSharedDocument(ctx.db, token);
    expect(shared?.document.id).toBe(id);
    const [stored] = await ctx.db.select().from(documents).where(eq(documents.id, id));
    expect(shared?.document.total).toBe(stored.total);
    expect(shared?.document.total).toBeGreaterThan(0);
    expect(shared?.lines).toHaveLength(1);
    expect(shared?.business.businessName).toBe("l1");
  });

  it("does not let another contractor create or revoke a link", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const ctxA = { db, contractorId: a.contractorId };
    const ctxB = { db, contractorId: b.contractorId };
    const { id } = await createDraftDocument(ctxA, a.jobId, "quote");
    await expect(createDocumentLink(ctxB, id)).rejects.toBeInstanceOf(NotFoundError);
    const token = await createDocumentLink(ctxA, id);
    await expect(revokeDocumentLink(ctxB, id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await getSharedDocument(db, token)).not.toBeNull();
    expect(await getActiveLinkToken(ctxB, id)).toBeNull();
  });

  it("returns not found for a turned-off, unknown or malformed token", async () => {
    const { ctx, id } = await draftQuote("l2");
    const token = await createDocumentLink(ctx, id);
    await revokeDocumentLink(ctx, id);
    expect(await getSharedDocument(ctx.db, token)).toBeNull();
    await expect(respondToSharedQuote(ctx.db, token, "approved")).rejects.toBeInstanceOf(NotFoundError);
    expect(await getSharedDocument(ctx.db, "x".repeat(32))).toBeNull();
    expect(await getSharedDocument(ctx.db, id)).toBeNull();
    expect(await getSharedDocument(ctx.db, "")).toBeNull();
    // Turning it back on makes a new token; the old one stays dead.
    const next = await createDocumentLink(ctx, id);
    expect(next).not.toBe(token);
    expect(await getSharedDocument(ctx.db, token)).toBeNull();
    expect(await getSharedDocument(ctx.db, next)).not.toBeNull();
  });

  it("a token only opens its own document", async () => {
    const { ctx: ctxA, id: idA } = await draftQuote("l3a");
    const { ctx: ctxB, id: idB } = await draftQuote("l3b");
    const tokenA = await createDocumentLink(ctxA, idA);
    const tokenB = await createDocumentLink(ctxB, idB);
    expect((await getSharedDocument(ctxA.db, tokenA))?.document.id).toBe(idA);
    expect((await getSharedDocument(ctxA.db, tokenB))?.document.id).toBe(idB);
    expect(tokenA).not.toBe(tokenB);
  });

  it("refuses new links on approved, declined and paid documents", async () => {
    const { ctx, id } = await draftQuote("l4");
    await setDocumentStatus(ctx, id, "sent");
    await setDocumentStatus(ctx, id, "approved");
    await expect(createDocumentLink(ctx, id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("approves a quote once, moves the job to active, and ignores a later decline", async () => {
    const { tenant, ctx, id } = await draftQuote("l5");
    await setDocumentStatus(ctx, id, "sent");
    const token = await createDocumentLink(ctx, id);

    const first = await respondToSharedQuote(ctx.db, token, "approved");
    expect(first).toMatchObject({ status: "approved", changed: true });
    const [job] = await ctx.db.select().from(jobs).where(eq(jobs.id, tenant.jobId));
    expect(job.status).toBe("active");
    const [afterFirst] = await ctx.db.select().from(documents).where(eq(documents.id, id));

    const again = await respondToSharedQuote(ctx.db, token, "approved");
    expect(again).toMatchObject({ status: "approved", changed: false });
    const flip = await respondToSharedQuote(ctx.db, token, "declined");
    expect(flip).toMatchObject({ status: "approved", changed: false });
    const [afterAll] = await ctx.db.select().from(documents).where(eq(documents.id, id));
    expect(afterAll.status).toBe("approved");
    expect(afterAll.closedAt).toBe(afterFirst.closedAt);
    expect(afterAll.updatedAt).toBe(afterFirst.updatedAt);
    // The link still shows the result.
    expect((await getSharedDocument(ctx.db, token))?.document.status).toBe("approved");
  });

  it("declines a quote without touching the job", async () => {
    const { tenant, ctx, id } = await draftQuote("l6");
    await setDocumentStatus(ctx, id, "sent");
    const token = await createDocumentLink(ctx, id);
    expect(await respondToSharedQuote(ctx.db, token, "declined")).toMatchObject({ status: "declined", changed: true });
    expect(await respondToSharedQuote(ctx.db, token, "approved")).toMatchObject({ status: "declined", changed: false });
    const [job] = await ctx.db.select().from(jobs).where(eq(jobs.id, tenant.jobId));
    expect(job.status).toBe("quoted");
  });

  it("treats a shared draft quote as sent when the client answers, and survives concurrent answers", async () => {
    const { ctx, id } = await draftQuote("l7");
    const token = await createDocumentLink(ctx, id);
    const results = await Promise.all([
      respondToSharedQuote(ctx.db, token, "approved"),
      respondToSharedQuote(ctx.db, token, "declined"),
    ]);
    expect(new Set(results.map((r) => r.status)).size).toBe(1);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    const [doc] = await ctx.db.select().from(documents).where(eq(documents.id, id));
    expect(doc.status).toBe(results[0].status);
    expect(doc.sentAt).not.toBeNull();
  });

  it("does not let a client answer an invoice, and invoice totals come from storage", async () => {
    const tenant = await seedTenant("l8");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const { id } = await createDraftDocument(ctx, tenant.jobId, "invoice");
    await saveDocumentLine(ctx, { jobId: tenant.jobId, documentId: id, kind: "material", description: "Pipe", quantity: 1, unit: "ea", unitPrice: 40 });
    await setDocumentStatus(ctx, id, "sent");
    const token = await createDocumentLink(ctx, id);
    await expect(respondToSharedQuote(ctx.db, token, "approved")).rejects.toBeInstanceOf(ValidationError);
    const shared = await getSharedDocument(ctx.db, token);
    const [stored] = await ctx.db.select().from(documents).where(eq(documents.id, id));
    expect(shared?.document.total).toBe(stored.total);
    expect(shared?.document.status).toBe("sent");
  });

  it("limits approve and decline attempts per token in a rolling hour", async () => {
    const { ctx, id } = await draftQuote("l10");
    await setDocumentStatus(ctx, id, "sent");
    const token = await createDocumentLink(ctx, id);
    const other = await draftQuote("l10b");
    await setDocumentStatus(other.ctx, other.id, "sent");
    const otherToken = await createDocumentLink(other.ctx, other.id);

    for (let i = 0; i < SHARE_ATTEMPT_MAX; i++) {
      await respondToSharedQuote(ctx.db, token, i % 2 === 0 ? "approved" : "declined");
    }
    const [docBefore] = await ctx.db.select().from(documents).where(eq(documents.id, id));
    await expect(respondToSharedQuote(ctx.db, token, "approved")).rejects.toMatchObject({
      message: SHARE_ATTEMPT_LIMIT_MESSAGE,
    });
    const [docAfter] = await ctx.db.select().from(documents).where(eq(documents.id, id));
    expect(docAfter.status).toBe(docBefore.status);

    expect(await respondToSharedQuote(other.ctx.db, otherToken, "approved")).toMatchObject({
      status: "approved",
      changed: true,
    });
  });

  it("removes links when a draft is deleted", async () => {
    const { ctx, id } = await draftQuote("l9");
    const token = await createDocumentLink(ctx, id);
    await deleteDraftDocument(ctx, id);
    expect(await getSharedDocument(ctx.db, token)).toBeNull();
    expect(await ctx.db.select().from(documentLinks).where(eq(documentLinks.documentId, id))).toEqual([]);
    expect(await ctx.db.select().from(lineItems).where(eq(lineItems.documentId, id))).toEqual([]);
  });
});

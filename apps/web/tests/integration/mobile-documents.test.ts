import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as invoiceQuote } from "@/app/api/v1/documents/[id]/invoice/route";
import { GET as getDocument } from "@/app/api/v1/documents/[id]/route";
import { POST as shareDocument } from "@/app/api/v1/documents/[id]/share/route";
import { POST as setStatus } from "@/app/api/v1/documents/[id]/status/route";
import { POST as invoiceJob } from "@/app/api/v1/jobs/[id]/invoice/route";
import { GET as getWorkspace } from "@/app/api/v1/jobs/[id]/workspace/route";
import { documentLinks, documents, jobs, lineItems } from "@/lib/db/schema";
import { respondToSharedQuote } from "@/lib/services/document-links";
import { createDraftDocument } from "@/lib/services/documents";
import { saveDocumentLine, saveTrackedLine } from "@/lib/services/line-items";
import { getTestDb } from "../helpers/db";
import { bearerFor, callRoute } from "../helpers/mobile";
import { seedTenant, type TenantSeed } from "../helpers/seed";

const env = { ...process.env };

async function quoteWithLine(tenant: TenantSeed) {
  const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
  const { id } = await createDraftDocument(ctx, tenant.jobId, "quote");
  await saveDocumentLine(ctx, { jobId: tenant.jobId, documentId: id, kind: "material", description: "Water heater", quantity: 1, unit: "ea", unitPrice: 900 });
  return id;
}

async function trackedLine(tenant: TenantSeed) {
  const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
  await saveTrackedLine(ctx, { jobId: tenant.jobId, kind: "labour", description: "Labour", quantity: 2, unit: "h", unitPrice: 95 });
}

async function statusOf(id: string) {
  const [row] = await getTestDb().select().from(documents).where(eq(documents.id, id));
  return row?.status;
}

async function readDocument(token: string, id: string) {
  const res = await callRoute(getDocument, id, { token, method: "GET" });
  expect(res.status).toBe(200);
  return (await res.json()).document;
}

describe("mobile document actions", () => {
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("runs a quote from share to paid invoice", async () => {
    process.env.AUTH_URL = "https://app.example.test/";
    const tenant = await seedTenant("phone-loop");
    const token = await bearerFor(tenant);
    const quoteId = await quoteWithLine(tenant);

    const draft = await readDocument(token, quoteId);
    expect(draft.actions).toContain("mark-sent");
    expect(draft.canShare).toBe(true);

    const shared = await callRoute(shareDocument, quoteId, { token });
    expect(shared.status).toBe(200);
    const { url } = await shared.json();
    const [link] = await getTestDb().select().from(documentLinks).where(eq(documentLinks.documentId, quoteId));
    expect(url).toBe(`https://app.example.test/d/${link!.token}`);
    expect((await (await callRoute(shareDocument, quoteId, { token })).json()).url).toBe(url);

    const sent = await callRoute(setStatus, quoteId, { token, body: { status: "sent" } });
    expect(sent.status).toBe(200);
    await respondToSharedQuote(getTestDb(), link!.token, "approved");

    const approved = await readDocument(token, quoteId);
    expect(approved.status).toBe("approved");
    expect(approved.actions).toContain("create-invoice");
    expect(approved.invoiceId).toBeNull();
    expect(approved.canShare).toBe(true);

    const before = await (await callRoute(getWorkspace, tenant.jobId, { token, method: "GET" })).json();
    expect(before.documents.find((doc: { id: string }) => doc.id === quoteId).canInvoice).toBe(true);

    const made = await callRoute(invoiceQuote, quoteId, { token });
    expect(made.status).toBe(200);
    const { documentId: invoiceId } = await made.json();
    const again = await callRoute(invoiceQuote, quoteId, { token });
    expect((await again.json()).documentId).toBe(invoiceId);
    expect((await readDocument(token, quoteId)).invoiceId).toBe(invoiceId);
    const after = await (await callRoute(getWorkspace, tenant.jobId, { token, method: "GET" })).json();
    expect(after.documents.find((doc: { id: string }) => doc.id === quoteId).canInvoice).toBe(false);

    for (const status of ["sent", "paid"]) {
      expect((await callRoute(setStatus, invoiceId, { token, body: { status } })).status).toBe(200);
    }
    expect(await statusOf(invoiceId)).toBe("paid");
    expect((await readDocument(token, invoiceId)).canShare).toBe(false);
    expect((await callRoute(shareDocument, invoiceId, { token })).status).toBe(409);
  });

  it("refuses status changes the rules don't allow", async () => {
    const tenant = await seedTenant("phone-status-rules");
    const token = await bearerFor(tenant);
    const quoteId = await quoteWithLine(tenant);

    const early = await callRoute(setStatus, quoteId, { token, body: { status: "approved" } });
    expect(early.status).toBe(400);
    expect((await early.json()).error).toEqual({ code: "invalid-status", message: "That status change isn't allowed." });
    expect((await callRoute(setStatus, quoteId, { token, body: { status: "draft" } })).status).toBe(400);
    expect((await callRoute(setStatus, quoteId, { token })).status).toBe(400);

    const invoice = await callRoute(invoiceQuote, quoteId, { token });
    expect(invoice.status).toBe(400);
    expect((await invoice.json()).error.code).toBe("quote-not-approved");
    expect(await statusOf(quoteId)).toBe("draft");
  });

  it("invoices tracked lines once", async () => {
    const tenant = await seedTenant("phone-tracked");
    const token = await bearerFor(tenant);
    await trackedLine(tenant);

    const made = await callRoute(invoiceJob, tenant.jobId, { token });
    expect(made.status).toBe(200);
    const { documentId } = await made.json();
    const document = await readDocument(token, documentId);
    expect(document.type).toBe("invoice");
    expect(document.subtotal).toBe(190);

    const again = await callRoute(invoiceJob, tenant.jobId, { token });
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe("nothing-to-bill");
  });

  it("refuses a missing token and another contractor's ids", async () => {
    const owner = await seedTenant("phone-owner");
    const other = await seedTenant("phone-other");
    const token = await bearerFor(other);
    const quoteId = await quoteWithLine(owner);
    await trackedLine(owner);
    const approvedId = await quoteWithLine(owner);
    await getTestDb().update(documents).set({ status: "approved" }).where(eq(documents.id, approvedId));

    const attempts = [
      [setStatus, quoteId, { status: "sent" }],
      [shareDocument, quoteId, undefined],
      [invoiceQuote, approvedId, undefined],
      [invoiceJob, owner.jobId, undefined],
    ] as const;
    for (const [route, id, body] of attempts) {
      expect((await callRoute(route, id, { body })).status).toBe(401);
      expect((await callRoute(route, id, { token, body })).status).toBe(404);
    }

    const db = getTestDb();
    expect(await statusOf(quoteId)).toBe("draft");
    expect(await db.select().from(documentLinks).where(eq(documentLinks.documentId, quoteId))).toHaveLength(0);
    expect(
      await db.select().from(documents).where(and(eq(documents.jobId, owner.jobId), eq(documents.type, "invoice"))),
    ).toHaveLength(0);
    const tracked = await db.select().from(lineItems).where(eq(lineItems.contractorId, owner.contractorId));
    expect(tracked.every((line) => line.billedDocumentId === null)).toBe(true);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, owner.jobId));
    expect(job?.status).toBe("quoted");
  });
});

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clients, documents } from "@/lib/db/schema";
import { clearFakeEmails, getFakeEmails } from "@/lib/email";
import { cad } from "@/lib/money";
import { NotFoundError } from "@/lib/services/context";
import { sendDocumentEmailToClient } from "@/lib/services/document-email";
import { createDraftDocument } from "@/lib/services/documents";
import { saveDocumentLine } from "@/lib/services/line-items";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";

const AUTH_URL = "https://app.test";

async function draftQuoteWithClientEmail(label: string, clientEmail: string) {
  const tenant = await seedTenant(label);
  const db = getTestDb();
  await db.update(clients).set({ email: clientEmail }).where(eq(clients.id, tenant.clientId));
  const ctx = { db, contractorId: tenant.contractorId };
  const { id } = await createDraftDocument(ctx, tenant.jobId, "quote");
  await saveDocumentLine(ctx, {
    jobId: tenant.jobId,
    documentId: id,
    kind: "labour",
    description: "Work",
    quantity: 2,
    unit: "hr",
    unitPrice: 50,
  });
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  return { tenant, ctx, id, doc: doc! };
}

describe("document email", () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "fake";
    clearFakeEmails();
  });

  afterEach(() => {
    clearFakeEmails();
    delete process.env.EMAIL_PROVIDER;
  });

  it("sends one fake message with number, total, and share path", async () => {
    const { ctx, id, doc } = await draftQuoteWithClientEmail("mail1", "client@example.com");
    const fakeSend = async (message: { to: string; subject: string; text: string }) => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail(message);
    };
    await sendDocumentEmailToClient(ctx, id, { authUrl: AUTH_URL, send: fakeSend });
    const sent = getFakeEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("client@example.com");
    expect(sent[0]?.subject).toContain(doc.number);
    expect(sent[0]?.text).toContain(doc.number);
    expect(sent[0]?.text).toContain(cad(doc.total));
    expect(sent[0]?.text).toMatch(/https:\/\/app\.test\/d\/[A-Za-z0-9_-]{32}/);
  });

  it("does not let another contractor send the email", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    await db.update(clients).set({ email: "client@example.com" }).where(eq(clients.id, a.clientId));
    const ctxA = { db, contractorId: a.contractorId };
    const ctxB = { db, contractorId: b.contractorId };
    const { id } = await createDraftDocument(ctxA, a.jobId, "quote");
    await expect(sendDocumentEmailToClient(ctxB, id, { authUrl: AUTH_URL })).rejects.toBeInstanceOf(NotFoundError);
    expect(getFakeEmails()).toHaveLength(0);
  });
});

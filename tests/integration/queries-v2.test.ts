import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { captures, documents } from "@/lib/db/schema";
import { getCaptureForContractor, getDocumentsForContractor, getHomeForContractor } from "@/lib/queries-v2";
import { newId } from "@/lib/id";
import { createDraftDocument } from "@/lib/services/documents";
import { saveTrackedLine } from "@/lib/services/line-items";
import { getTestDb } from "../helpers/db";
import { seedTwoContractors } from "../helpers/seed";

describe("v2 queries", () => {
  it("filters documents by contractor", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    await createDraftDocument({ db, contractorId: b.contractorId }, b.jobId, "quote");
    await createDraftDocument({ db, contractorId: a.contractorId }, a.jobId, "quote");
    const docs = await getDocumentsForContractor(db, a.contractorId, { type: "quote" });
    expect(docs.items).toHaveLength(1);
  });

  it("builds home summary", async () => {
    const { a } = await seedTwoContractors();
    const db = getTestDb();
    const ctx = { db, contractorId: a.contractorId };
    await saveTrackedLine(ctx, { jobId: a.jobId, kind: "labour", description: "Work", quantity: 2, unit: "hr", unitPrice: 50 });
    const { id } = await createDraftDocument(ctx, a.jobId, "invoice");
    await db.update(documents).set({ status: "sent", dueDate: "2020-01-01" }).where(eq(documents.id, id));
    const home = await getHomeForContractor(db, a.contractorId, "2026-01-01");
    expect(home.openJobs[0]?.unbilledTotal).toBe(100);
    expect(home.unpaidInvoices.some((row) => row.overdue)).toBe(true);
  });

  it("scopes getCapture by contractor", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const captureId = newId();
    await db.insert(captures).values({
      id: captureId,
      contractorId: b.contractorId,
      type: "text",
      status: "needs_review",
      transcript: "secret",
      createdAt: Date.now(),
    });
    expect(await getCaptureForContractor(db, a.contractorId, captureId)).toBeNull();
    expect(await getCaptureForContractor(db, b.contractorId, captureId)?.id).toBe(captureId);
  });
});

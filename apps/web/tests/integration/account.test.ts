import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  captures,
  clients,
  contractors,
  documentLinks,
  documents,
  jobs,
  lineItems,
  planMessages,
  plans,
  users,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { deleteAccount, exportAccountData } from "@/lib/services/account";
import { ValidationError } from "@/lib/services/context";
import { createDraftDocument } from "@/lib/services/documents";
import { saveTrackedLine } from "@/lib/services/line-items";
import { createMemoryReceiptStorage } from "@/lib/storage/fake";
import { receiptImagePath } from "@/lib/storage/receipts";
import { getTestDb } from "../helpers/db";
import { seedTwoContractors } from "../helpers/seed";

async function seedData(tenant: { contractorId: string; jobId: string }, storage: ReturnType<typeof createMemoryReceiptStorage>) {
  const db = getTestDb();
  const ctx = { db, contractorId: tenant.contractorId };
  await saveTrackedLine(ctx, { jobId: tenant.jobId, kind: "material", description: "Valve", quantity: 1, unit: "ea", unitPrice: 12 });
  const document = await createDraftDocument(ctx, tenant.jobId, "quote");
  const now = Date.now();
  const planId = newId();
  await db.insert(plans).values({
    id: planId,
    contractorId: tenant.contractorId,
    title: "Kitchen",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(planMessages).values({
    id: newId(),
    planId,
    contractorId: tenant.contractorId,
    role: "user",
    body: "add a valve",
    createdAt: now,
  });
  await db.insert(documentLinks).values({
    id: newId(),
    contractorId: tenant.contractorId,
    documentId: document.id,
    token: newId(),
    createdAt: now,
  });
  const captureId = newId();
  const imagePath = receiptImagePath(tenant.contractorId, captureId);
  await storage.put({ path: imagePath, bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" });
  await db.insert(captures).values({
    id: captureId,
    contractorId: tenant.contractorId,
    jobId: tenant.jobId,
    type: "receipt",
    status: "ready",
    imagePath,
    transcript: "two valves",
    extraction: { lines: [] },
    createdAt: Date.now(),
  });
  return imagePath;
}

describe("account export and deletion", () => {
  it("exports only the contractor's own rows, with receipt paths and no bytes", async () => {
    const { a, b } = await seedTwoContractors();
    const storage = createMemoryReceiptStorage();
    const pathA = await seedData(a, storage);
    await seedData(b, storage);

    const data = await exportAccountData({ db: getTestDb(), contractorId: a.contractorId });
    expect(data.contractor.id).toBe(a.contractorId);
    expect(data.clients.map((r) => r.id)).toEqual([a.clientId]);
    expect(data.jobs.map((r) => r.id)).toEqual([a.jobId]);
    expect(data.documents.length).toBe(1);
    expect(data.lineItems.length).toBe(1);
    expect(data.captures.length).toBe(1);
    expect(data.captures[0].transcript).toBe("two valves");
    expect(data.captures[0].imagePath).toBe(pathA);
    expect(data.plans.map((row) => row.title)).toEqual(["Kitchen"]);
    expect(data.planMessages.map((row) => row.body)).toEqual(["add a valve"]);
    expect(data.documentLinks).toHaveLength(1);
    for (const rows of [data.clients, data.jobs, data.documents, data.lineItems, data.captures, data.plans, data.planMessages, data.documentLinks]) {
      expect(rows.every((r) => r.contractorId === a.contractorId)).toBe(true);
    }
    expect(JSON.stringify(data)).not.toContain(b.contractorId);
  });

  it("does nothing when the business name is wrong", async () => {
    const { a } = await seedTwoContractors();
    const storage = createMemoryReceiptStorage();
    const path = await seedData(a, storage);

    await expect(
      deleteAccount({ db: getTestDb(), contractorId: a.contractorId }, { confirmBusinessName: "Nope", storage }),
    ).rejects.toBeInstanceOf(ValidationError);

    const db = getTestDb();
    expect(await db.select().from(contractors).where(eq(contractors.id, a.contractorId))).toHaveLength(1);
    expect(await db.select().from(captures).where(eq(captures.contractorId, a.contractorId))).toHaveLength(1);
    expect(await db.select().from(plans).where(eq(plans.contractorId, a.contractorId))).toHaveLength(1);
    expect(await db.select().from(documentLinks).where(eq(documentLinks.contractorId, a.contractorId))).toHaveLength(1);
    expect(storage.has(path)).toBe(true);
  });

  it("deletes this contractor's rows and receipts and leaves another contractor's", async () => {
    const { a, b } = await seedTwoContractors();
    const storage = createMemoryReceiptStorage();
    const pathA = await seedData(a, storage);
    const pathB = await seedData(b, storage);
    const db = getTestDb();

    const result = await deleteAccount({ db, contractorId: a.contractorId }, { confirmBusinessName: " a ", storage });
    expect(result).toEqual({ receiptsRemoved: 1, receiptsFailed: 0 });

    for (const table of [clients, jobs, documents, lineItems, captures, plans, planMessages, documentLinks]) {
      expect(await db.select().from(table).where(eq(table.contractorId, a.contractorId))).toHaveLength(0);
      expect((await db.select().from(table).where(eq(table.contractorId, b.contractorId))).length).toBeGreaterThan(0);
    }
    expect(await db.select().from(contractors).where(eq(contractors.id, a.contractorId))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, a.userId))).toHaveLength(0);
    expect(await db.select().from(contractors).where(eq(contractors.id, b.contractorId))).toHaveLength(1);
    expect(await db.select().from(users).where(eq(users.id, b.userId))).toHaveLength(1);
    expect(storage.has(pathA)).toBe(false);
    expect(storage.has(pathB)).toBe(true);
  });

  it("counts storage failures without throwing or undoing the row deletion", async () => {
    const { a } = await seedTwoContractors();
    const storage = createMemoryReceiptStorage();
    await seedData(a, storage);
    const failing = { remove: async () => { throw new Error("storage down"); } };

    const result = await deleteAccount({ db: getTestDb(), contractorId: a.contractorId }, { confirmBusinessName: "A", storage: failing });
    expect(result).toEqual({ receiptsRemoved: 0, receiptsFailed: 1 });
    expect(await getTestDb().select().from(contractors).where(eq(contractors.id, a.contractorId))).toHaveLength(0);
  });
});

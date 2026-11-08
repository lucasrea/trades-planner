import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/captures/receipt/route";
import * as auth from "@/lib/auth";
import { captures, documents, jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { getCaptureResultJobsForContractor } from "@/lib/queries-v2";
import { applyMarkup } from "@/lib/money";
import { confirmCapture } from "@/lib/services/captures";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { getMemoryReceiptStorage } from "@/lib/storage/receipts";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";

const env = process.env;
const storage = getMemoryReceiptStorage();

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);

function receiptRequest(
  file: File | null,
  fields: { jobId?: string; note?: string } = {},
  headers: Record<string, string> = {},
) {
  const form = new FormData();
  if (file) form.set("image", file);
  if (fields.jobId) form.set("jobId", fields.jobId);
  if (fields.note) form.set("note", fields.note);
  return POST(
    new Request("http://localhost/api/captures/receipt", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", ...headers },
      body: form,
    }),
  );
}

const jpegFile = () => new File([JPEG], "receipt.jpg", { type: "image/jpeg" });

function signIn(tenant: { userId: string; contractorId: string }) {
  vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
}

describe("POST /api/captures/receipt", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "fake";
    process.env.AI_FAKE_MODE = "ok";
    storage.clear();
  });

  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(null);
    const res = await receiptRequest(jpegFile());
    expect(res.status).toBe(401);
    expect(storage.paths()).toHaveLength(0);
  });

  it("blocks cross-origin requests", async () => {
    const tenant = await seedTenant("rcpt403");
    signIn(tenant);
    const res = await receiptRequest(jpegFile(), {}, { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
  });

  it("rejects bytes that are not JPEG, PNG or WebP even when the type says image/jpeg", async () => {
    const tenant = await seedTenant("rcptmagic");
    signIn(tenant);
    const res = await receiptRequest(new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(400);
    expect(storage.paths()).toHaveLength(0);
    const rows = await getTestDb().select().from(captures).where(eq(captures.contractorId, tenant.contractorId));
    expect(rows).toHaveLength(0);
  });

  it("rejects a photo over 4 MB", async () => {
    const tenant = await seedTenant("rcpt413");
    signIn(tenant);
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(JPEG);
    const res = await receiptRequest(new File([big], "big.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(413);
  });

  it("returns 400 without a photo", async () => {
    const tenant = await seedTenant("rcptnone");
    signIn(tenant);
    const res = await receiptRequest(null);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a job that belongs to another contractor", async () => {
    const { a, b } = await seedTwoContractors();
    signIn(a);
    const res = await receiptRequest(jpegFile(), { jobId: b.jobId });
    expect(res.status).toBe(404);
    expect(storage.paths()).toHaveLength(0);
    const rows = await getTestDb().select().from(captures).where(eq(captures.contractorId, a.contractorId));
    expect(rows).toHaveLength(0);
  });

  it("returns 429 after the hourly capture limit", async () => {
    const tenant = await seedTenant("rcptrate");
    signIn(tenant);
    const db = getTestDb();
    const now = Date.now();
    for (let i = 0; i < 30; i += 1) {
      await db.insert(captures).values({
        id: newId(),
        contractorId: tenant.contractorId,
        type: "text",
        status: "needs_review",
        transcript: "x",
        createdAt: now - i * 1000,
      });
    }
    const res = await receiptRequest(jpegFile());
    expect(res.status).toBe(429);
    expect(storage.paths()).toHaveLength(0);
  });

  it("stores the photo privately, saves its path, and creates a receipt capture with no job", async () => {
    const tenant = await seedTenant("rcptok");
    signIn(tenant);
    const res = await receiptRequest(jpegFile());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("needs_review");
    const [row] = await getTestDb().select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.type).toBe("receipt");
    expect(row?.jobId).toBeNull();
    const expectedPath = `receipts/${tenant.contractorId}/${body.captureId}.jpg`;
    expect(row?.imagePath).toBe(expectedPath);
    expect(storage.has(expectedPath)).toBe(true);
    expect(storage.get(expectedPath)?.bytes).toEqual(JPEG);
    const extraction = row?.extraction as { lines: { jobId: string | null }[] };
    expect(extraction.lines).toHaveLength(2);
    expect(extraction.lines.every((line) => line.jobId === null)).toBe(true);
    // Nothing is written to the job ledger until confirm.
    const lines = await getTestDb().select().from(lineItems).where(eq(lineItems.contractorId, tenant.contractorId));
    expect(lines).toHaveLength(0);
  });

  it("aims every line at the job page's job", async () => {
    const tenant = await seedTenant("rcptjob");
    signIn(tenant);
    const res = await receiptRequest(jpegFile(), { jobId: tenant.jobId });
    const body = await res.json();
    const [row] = await getTestDb().select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.jobId).toBe(tenant.jobId);
    const extraction = row?.extraction as { lines: { jobId: string | null }[] };
    expect(extraction.lines.every((line) => line.jobId === tenant.jobId)).toBe(true);
  });

  it("aims lines at the job named in the note", async () => {
    const tenant = await seedTenant("rcptnote");
    const db = getTestDb();
    const kitchenId = newId();
    const now = Date.now();
    await db.insert(jobs).values({
      id: kitchenId,
      contractorId: tenant.contractorId,
      clientId: tenant.clientId,
      title: "Kitchen remodel",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    signIn(tenant);
    const res = await receiptRequest(jpegFile(), { note: "add this to the kitchen" });
    const body = await res.json();
    const [row] = await db.select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.jobId).toBe(kitchenId);
    expect(row?.transcript).toBe("add this to the kitchen");
    const extraction = row?.extraction as { lines: { jobId: string | null }[] };
    expect(extraction.lines.every((line) => line.jobId === kitchenId)).toBe(true);
  });

  it("does not guess when the note names no job or the wrong tenant's job", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const now = Date.now();
    await db.insert(jobs).values({
      id: newId(),
      contractorId: b.contractorId,
      clientId: b.clientId,
      title: "Garage conversion",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    signIn(a);
    const res = await receiptRequest(jpegFile(), { note: "add this to the garage" });
    const body = await res.json();
    const [row] = await db.select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.jobId).toBeNull();
  });

  it("marks the capture failed when vision cannot read it, and keeps the photo path", async () => {
    process.env.AI_FAKE_MODE = "error";
    const tenant = await seedTenant("rcptfail");
    signIn(tenant);
    const res = await receiptRequest(jpegFile());
    const body = await res.json();
    expect(body.status).toBe("failed");
    const [row] = await getTestDb().select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.status).toBe("failed");
    expect(row?.error).toBeTruthy();
  });

  it("marks the capture failed when storage rejects the upload", async () => {
    const tenant = await seedTenant("rcptstore");
    signIn(tenant);
    storage.failNextPut();
    const res = await receiptRequest(jpegFile());
    const body = await res.json();
    expect(body.status).toBe("failed");
    const [row] = await getTestDb().select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.imagePath).toBeNull();
  });
});

describe("confirm receipt capture", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "fake";
    process.env.AI_FAKE_MODE = "ok";
    storage.clear();
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  async function receiptCapture(tenant: { userId: string; contractorId: string }) {
    signIn(tenant);
    const res = await receiptRequest(jpegFile());
    const body = await res.json();
    return body.captureId as string;
  }

  async function addJob(tenant: { contractorId: string; clientId: string }, title: string) {
    const id = newId();
    const now = Date.now();
    await getTestDb().insert(jobs).values({
      id,
      contractorId: tenant.contractorId,
      clientId: tenant.clientId,
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  it("writes unbilled material lines on each assigned job and creates no invoice", async () => {
    const tenant = await seedTenant("rcfm");
    const secondJob = await addJob(tenant, "Bathroom");
    const captureId = await receiptCapture(tenant);
    const db = getTestDb();
    const ctx = { db, contractorId: tenant.contractorId };
    const markup = 20;

    const result = await confirmCapture(ctx, {
      captureId,
      createAs: "log",
      lines: [
        { kind: "material", description: "PEX fittings", quantity: 1, unit: "ea", unitCost: 45, unitPrice: applyMarkup(45, markup), jobId: tenant.jobId },
        { kind: "material", description: "Teflon tape", quantity: 3, unit: "ea", unitCost: 8, unitPrice: applyMarkup(8, markup), jobId: secondJob },
      ],
    });
    expect(result.kind).toBe("log");
    if (result.kind !== "log") return;
    expect([...result.jobIds].sort()).toEqual([tenant.jobId, secondJob].sort());

    const rows = await db.select().from(lineItems).where(eq(lineItems.captureId, captureId));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.kind).toBe("material");
      expect(row.documentId).toBeNull();
      expect(row.billedDocumentId).toBeNull();
    }
    const pex = rows.find((row) => row.description === "PEX fittings");
    expect(pex?.jobId).toBe(tenant.jobId);
    expect(pex?.unitCost).toBe(45);
    expect(pex?.unitPrice).toBe(54);
    const tape = rows.find((row) => row.description === "Teflon tape");
    expect(tape?.jobId).toBe(secondJob);
    expect(tape?.unitCost).toBe(8);
    expect(tape?.unitPrice).toBe(9.6);
    expect(tape?.lineTotal).toBe(28.8);

    const unbilledOnFirst = await db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.jobId, tenant.jobId), isNull(lineItems.documentId)));
    expect(unbilledOnFirst).toHaveLength(1);

    const docs = await db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId));
    expect(docs).toHaveLength(0);
    const [capture] = await db.select().from(captures).where(eq(captures.id, captureId)).limit(1);
    expect(capture?.status).toBe("confirmed");

    const resultJobs = await getCaptureResultJobsForContractor(db, tenant.contractorId, captureId);
    expect(resultJobs.map((job) => [job.id, job.lineCount]).sort()).toEqual([[tenant.jobId, 1], [secondJob, 1]].sort());
    expect(await getCaptureResultJobsForContractor(db, "someone-else", captureId)).toHaveLength(0);
  });

  it("starts a new job (and client) from the preview and puts lines on it", async () => {
    const tenant = await seedTenant("rcnew");
    const captureId = await receiptCapture(tenant);
    const db = getTestDb();
    const ctx = { db, contractorId: tenant.contractorId };
    const result = await confirmCapture(ctx, {
      captureId,
      createAs: "log",
      newJobs: [{ key: "k1", title: "Deck rebuild", client: { name: "New Client" } }],
      lines: [
        { kind: "material", description: "PEX fittings", quantity: 1, unit: "ea", unitCost: 45, unitPrice: 54, jobId: "new:k1" },
        { kind: "material", description: "Teflon tape", quantity: 3, unit: "ea", unitCost: 8, unitPrice: 9.6, jobId: tenant.jobId },
      ],
    });
    expect(result.kind).toBe("log");
    if (result.kind !== "log") return;
    expect(result.jobIds).toHaveLength(2);
    const [created] = await db.select().from(jobs).where(and(eq(jobs.contractorId, tenant.contractorId), eq(jobs.title, "Deck rebuild"))).limit(1);
    expect(created?.status).toBe("active");
    const onNew = await db.select().from(lineItems).where(eq(lineItems.jobId, created!.id));
    expect(onNew).toHaveLength(1);
    expect(onNew[0]?.documentId).toBeNull();
    const docs = await db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId));
    expect(docs).toHaveLength(0);
  });

  it("rolls back everything when a line points at a foreign job", async () => {
    const { a, b } = await seedTwoContractors();
    const captureId = await receiptCapture(a);
    const db = getTestDb();
    await expect(
      confirmCapture(
        { db, contractorId: a.contractorId },
        {
          captureId,
          createAs: "log",
          newJobs: [{ key: "k1", title: "Should not exist", client: { name: "Ghost" } }],
          lines: [
            { kind: "material", description: "A", quantity: 1, unit: "ea", unitCost: 1, unitPrice: 1.2, jobId: "new:k1" },
            { kind: "material", description: "B", quantity: 1, unit: "ea", unitCost: 1, unitPrice: 1.2, jobId: b.jobId },
          ],
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await db.select().from(lineItems).where(eq(lineItems.captureId, captureId))).toHaveLength(0);
    expect(await db.select().from(jobs).where(eq(jobs.title, "Should not exist"))).toHaveLength(0);
    const [capture] = await db.select().from(captures).where(eq(captures.id, captureId)).limit(1);
    expect(capture?.status).toBe("needs_review");
  });

  it("refuses a line with no cost, a new job nobody uses, or an unknown new job key", async () => {
    const tenant = await seedTenant("rcbad");
    const captureId = await receiptCapture(tenant);
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const base = { kind: "material" as const, description: "A", quantity: 1, unit: "ea", unitPrice: 1.2 };
    await expect(
      confirmCapture(ctx, { captureId, createAs: "log", lines: [{ ...base, jobId: tenant.jobId }] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      confirmCapture(ctx, {
        captureId,
        createAs: "log",
        newJobs: [{ key: "unused", title: "Empty", client: { name: "X" } }],
        lines: [{ ...base, unitCost: 1, jobId: tenant.jobId }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      confirmCapture(ctx, { captureId, createAs: "log", lines: [{ ...base, unitCost: 1, jobId: "new:missing" }] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await ctx.db.select().from(lineItems).where(eq(lineItems.captureId, captureId))).toHaveLength(0);
  });

  it("forces receipt lines to be materials and is idempotent on a second confirm", async () => {
    const tenant = await seedTenant("rcidem");
    const captureId = await receiptCapture(tenant);
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const input = {
      captureId,
      createAs: "log" as const,
      lines: [{ kind: "labour" as const, description: "A", quantity: 1, unit: "ea", unitCost: 5, unitPrice: 6, jobId: tenant.jobId }],
    };
    await confirmCapture(ctx, input);
    const again = await confirmCapture(ctx, input);
    expect(again.kind).toBe("log");
    const rows = await ctx.db.select().from(lineItems).where(eq(lineItems.captureId, captureId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("material");
  });

  it("cannot confirm another contractor's capture", async () => {
    const { a, b } = await seedTwoContractors();
    const captureId = await receiptCapture(a);
    await expect(
      confirmCapture(
        { db: getTestDb(), contractorId: b.contractorId },
        {
          captureId,
          createAs: "log",
          lines: [{ kind: "material", description: "A", quantity: 1, unit: "ea", unitCost: 1, unitPrice: 1, jobId: b.jobId }],
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not let a discarded receipt be confirmed", async () => {
    const tenant = await seedTenant("rcdisc");
    const captureId = await receiptCapture(tenant);
    const db = getTestDb();
    await db.update(captures).set({ status: "discarded" }).where(eq(captures.id, captureId));
    await expect(
      confirmCapture(
        { db, contractorId: tenant.contractorId },
        {
          captureId,
          createAs: "log",
          lines: [{ kind: "material", description: "A", quantity: 1, unit: "ea", unitCost: 1, unitPrice: 1, jobId: tenant.jobId }],
        },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

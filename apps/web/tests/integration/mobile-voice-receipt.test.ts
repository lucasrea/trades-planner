import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webReceipt } from "@/app/api/captures/receipt/route";
import { POST as webText } from "@/app/api/captures/text/route";
import { POST as webVoice } from "@/app/api/captures/voice/route";
import { POST as cancelRoute } from "@/app/api/v1/captures/[id]/cancel/route";
import { POST as receiptConfirm } from "@/app/api/v1/captures/[id]/receipt-confirm/route";
import { GET as receiptReview } from "@/app/api/v1/captures/[id]/receipt/route";
import { POST as phoneReceipt } from "@/app/api/v1/captures/receipt/route";
import { POST as phoneText } from "@/app/api/v1/captures/text/route";
import { POST as phoneVoice } from "@/app/api/v1/captures/voice/route";
import { GET as listJobs } from "@/app/api/v1/jobs/route";
import * as providers from "@/lib/ai/fake";
import * as auth from "@/lib/auth";
import { captures, clients, documents, jobs, lineItems, planMessages, plans } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { getMemoryReceiptStorage } from "@/lib/storage/receipts";
import { getTestDb } from "../helpers/db";
import { bearerFor, callRoute } from "../helpers/mobile";
import { seedTenant, type TenantSeed } from "../helpers/seed";

const env = { ...process.env };
const storage = getMemoryReceiptStorage();
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);

const photo = () => new File([JPEG], "receipt.jpg", { type: "image/jpeg" });
const recording = () => new File([new Uint8Array([1, 2, 3, 4])], "capture.m4a", { type: "audio/m4a" });

type FormRoute = (request: Request) => Promise<Response>;

function upload(route: FormRoute, headers: Record<string, string>, fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return route(new Request("http://localhost/api/upload", { method: "POST", headers, body: form }));
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const sameOrigin = { "sec-fetch-site": "same-origin" };

function hears(text: string) {
  vi.spyOn(providers, "getTranscriptionProvider").mockReturnValue({ transcribe: async () => text });
}

async function secondJob(tenant: TenantSeed, status = "active") {
  const id = newId();
  const now = Date.now();
  await getTestDb().insert(jobs).values({
    id,
    contractorId: tenant.contractorId,
    clientId: tenant.clientId,
    title: `Second ${status}`,
    status,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function capturesFor(tenant: TenantSeed) {
  return getTestDb().select().from(captures).where(eq(captures.contractorId, tenant.contractorId));
}

beforeEach(() => {
  process.env.AI_PROVIDER = "fake";
  process.env.AI_FAKE_MODE = "ok";
  storage.clear();
});

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("one interpreter for every way in", () => {
  const SENTENCES = [
    "add a valve at $45 to the kitchen",
    "log 2 hours on the kitchen",
    "Quote a water heater replacement at $900 for a new client Dana Lee",
    "hi, what unbilled work do I have?",
    "invoice the unbilled work on the kitchen",
  ];

  /** The card a turn showed, without the ids that differ per tenant. */
  function comparable(body: { reply: string | null; preview: Record<string, unknown> | null }, tenant: TenantSeed) {
    return JSON.parse(JSON.stringify({ reply: body.reply, preview: body.preview }).replaceAll(tenant.jobId, "JOB"));
  }

  async function kitchenTenant(label: string) {
    const tenant = await seedTenant(label);
    const db = getTestDb();
    await db.update(jobs).set({ title: "Kitchen" }).where(eq(jobs.id, tenant.jobId));
    await db.update(clients).set({ name: "Pat Chen" }).where(eq(clients.id, tenant.clientId));
    await db.insert(lineItems).values({
      id: newId(),
      contractorId: tenant.contractorId,
      jobId: tenant.jobId,
      sortOrder: 0,
      kind: "labour",
      description: "Labour",
      quantity: 2,
      unit: "h",
      unitPrice: 95,
      lineTotal: 190,
      createdAt: Date.now(),
    });
    return tenant;
  }

  async function agree(sentence: string) {
    const ways = ["web-text", "web-voice", "phone-text", "phone-voice"] as const;
    const seen: unknown[] = [];
    for (const way of ways) {
      const tenant = await kitchenTenant(`parity-${way}-${newId()}`);
      vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
      const token = await bearerFor(tenant);
      hears(sentence);
      const json = (route: FormRoute, headers: Record<string, string>) =>
        route(
          new Request("http://localhost/api/text", {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: JSON.stringify({ text: sentence, planId: "new" }),
          }),
        );
      const res =
        way === "web-text"
          ? await json(webText, sameOrigin)
          : way === "phone-text"
            ? await json(phoneText, bearer(token))
            : way === "web-voice"
              ? await upload(webVoice, sameOrigin, { audio: recording(), planId: "new" })
              : await upload(phoneVoice, bearer(token), { audio: recording(), planId: "new" });
      expect(res.status, way).toBe(200);
      seen.push(comparable(await res.json(), tenant));
    }
    expect(seen[0]).not.toEqual({ reply: null, preview: null });
    for (const other of seen.slice(1)) expect(other).toEqual(seen[0]);
  }

  for (const sentence of SENTENCES) {
    it(`web text, web voice, phone text and phone voice agree: ${sentence}`, () => agree(sentence));
  }
});

describe("POST /api/v1/captures/voice", () => {
  it("saves the turn on a plan, returns every card and keeps no audio", async () => {
    const tenant = await seedTenant("phone-voice");
    const token = await bearerFor(tenant);
    hears("add a valve at $45 to the kitchen");
    const res = await upload(phoneVoice, bearer(token), { audio: recording(), planId: "new", jobId: tenant.jobId });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe("add a valve at $45 to the kitchen");
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].preview.jobId).toBe(tenant.jobId);
    const [row] = await capturesFor(tenant);
    expect(row?.type).toBe("voice");
    expect(row?.imagePath ?? null).toBeNull();
    const messages = await getTestDb().select().from(planMessages).where(eq(planMessages.planId, body.planId));
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(storage.paths()).toHaveLength(0);
  });

  it("rejects a missing recording and the wrong type", async () => {
    const tenant = await seedTenant("phone-voice-bad");
    const token = await bearerFor(tenant);
    expect((await upload(phoneVoice, bearer(token), {})).status).toBe(400);
    const wrong = new File([new Uint8Array([1])], "a.mp3", { type: "audio/mpeg" });
    expect((await upload(phoneVoice, bearer(token), { audio: wrong })).status).toBe(400);
  });

  it("refuses a missing token and another contractor's job or plan", async () => {
    const owner = await seedTenant("phone-voice-owner");
    const other = await seedTenant("phone-voice-other");
    const ownerToken = await bearerFor(owner);
    const token = await bearerFor(other);
    hears("add a valve at $45");
    const saved = await (await upload(phoneVoice, bearer(ownerToken), { audio: recording(), planId: "new" })).json();

    expect((await upload(phoneVoice, {}, { audio: recording() })).status).toBe(401);
    expect((await upload(phoneVoice, bearer(token), { audio: recording(), jobId: owner.jobId })).status).toBe(404);
    expect((await upload(phoneVoice, bearer(token), { audio: recording(), planId: saved.planId })).status).toBe(404);
    expect(await getTestDb().select().from(plans).where(eq(plans.contractorId, other.contractorId))).toHaveLength(0);
  });

  it("is off when capture is turned off", async () => {
    process.env.AI_CAPTURE_ENABLED = "false";
    const tenant = await seedTenant("phone-voice-off");
    const token = await bearerFor(tenant);
    expect((await upload(phoneVoice, bearer(token), { audio: recording() })).status).toBe(503);
    expect((await upload(phoneReceipt, bearer(token), { image: photo() })).status).toBe(503);
  });
});

describe("phone receipts", () => {
  async function sendPhoto(token: string, fields: Record<string, string> = {}) {
    const res = await upload(phoneReceipt, bearer(token), { image: photo(), ...fields });
    expect(res.status).toBe(200);
    return (await res.json()) as { captureId: string; status: string; planId: string | null };
  }

  async function review(token: string, captureId: string) {
    const res = await callRoute(receiptReview, captureId, { token, method: "GET" });
    expect(res.status).toBe(200);
    return (await res.json()).receipt;
  }

  it("splits one receipt across two jobs without making an invoice", async () => {
    const tenant = await seedTenant("phone-receipt");
    const token = await bearerFor(tenant);
    const other = await secondJob(tenant);
    await secondJob(tenant, "completed");

    const sent = await sendPhoto(token, { planId: "new", note: "supply run" });
    expect(sent.status).toBe("needs_review");
    expect(sent.planId).toBeTruthy();
    expect(storage.paths()).toEqual([`receipts/${tenant.contractorId}/${sent.captureId}.jpg`]);

    const receipt = await review(token, sent.captureId);
    expect(receipt.lines.length).toBeGreaterThanOrEqual(2);
    expect(receipt.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(receipt.note).toBe("supply run");
    expect(receipt.jobs.map((job: { id: string }) => job.id).sort()).toEqual([tenant.jobId, other].sort());
    expect(receipt.clients).toEqual([{ id: tenant.clientId, name: expect.any(String) }]);

    const open = await listJobs(new Request("http://localhost/api/v1/jobs?open=1", { headers: bearer(token) }));
    expect((await open.json()).jobs).toHaveLength(2);

    const lines = receipt.lines.map(
      (line: { description: string; quantity: number; cost: number; price: number }, index: number) => ({
        kind: "material",
        description: line.description,
        quantity: line.quantity,
        unit: "ea",
        unitCost: line.cost,
        unitPrice: line.price,
        jobId: index === 0 ? tenant.jobId : other,
      }),
    );
    const confirmed = await callRoute(receiptConfirm, sent.captureId, { token, body: { lines } });
    expect(confirmed.status).toBe(200);
    const result = await confirmed.json();
    expect(result.kind).toBe("log");
    expect(result.jobIds.sort()).toEqual([tenant.jobId, other].sort());

    const db = getTestDb();
    const written = await db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.captureId, sent.captureId), isNull(lineItems.documentId)));
    expect(written).toHaveLength(lines.length);
    expect(await db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId))).toHaveLength(0);
    expect((await review(token, sent.captureId)).status).toBe("confirmed");
  });

  it("starts a new job for the lines, and explains a refused confirm", async () => {
    const tenant = await seedTenant("phone-receipt-new");
    const token = await bearerFor(tenant);
    const { captureId } = await sendPhoto(token);
    const receipt = await review(token, captureId);
    const lines = receipt.lines.map((line: { description: string; quantity: number; cost: number; price: number }) => ({
      kind: "material",
      description: line.description,
      quantity: line.quantity,
      unit: "ea",
      unitCost: line.cost,
      unitPrice: line.price,
      jobId: "new:a",
    }));

    const orphan = await callRoute(receiptConfirm, captureId, { token, body: { lines } });
    expect(orphan.status).toBe(400);
    expect((await orphan.json()).error.message).toBe("Line points at a job that was not started.");
    expect((await callRoute(receiptConfirm, captureId, { token, body: { lines: [] } })).status).toBe(400);

    const ok = await callRoute(receiptConfirm, captureId, {
      token,
      body: { lines, newJobs: [{ key: "a", title: "Basement", client: { id: tenant.clientId } }] },
    });
    expect(ok.status).toBe(200);
    const [jobId] = (await ok.json()).jobIds;
    const [job] = await getTestDb().select().from(jobs).where(eq(jobs.id, jobId));
    expect(job).toMatchObject({ title: "Basement", contractorId: tenant.contractorId });
  });

  it("discards a receipt through cancel", async () => {
    const tenant = await seedTenant("phone-receipt-cancel");
    const token = await bearerFor(tenant);
    const { captureId } = await sendPhoto(token);
    expect((await callRoute(cancelRoute, captureId, { token })).status).toBe(200);
    expect((await review(token, captureId)).status).toBe("discarded");
  });

  it("refuses a missing token and another contractor's ids", async () => {
    const owner = await seedTenant("phone-receipt-owner");
    const other = await seedTenant("phone-receipt-other");
    const ownerToken = await bearerFor(owner);
    const token = await bearerFor(other);
    const { captureId, planId } = await sendPhoto(ownerToken, { planId: "new" });
    const mine = await sendPhoto(token);

    expect((await upload(phoneReceipt, {}, { image: photo() })).status).toBe(401);
    expect((await upload(phoneReceipt, bearer(token), { image: photo(), jobId: owner.jobId })).status).toBe(404);
    expect((await upload(phoneReceipt, bearer(token), { image: photo(), planId: planId! })).status).toBe(404);

    expect((await callRoute(receiptReview, captureId, { method: "GET" })).status).toBe(401);
    expect((await callRoute(receiptReview, captureId, { token, method: "GET" })).status).toBe(404);

    const line = { kind: "material", description: "valve", quantity: 1, unit: "ea", unitCost: 1, unitPrice: 2 };
    const theirCapture = { lines: [{ ...line, jobId: other.jobId }] };
    expect((await callRoute(receiptConfirm, captureId, { body: theirCapture })).status).toBe(401);
    expect((await callRoute(receiptConfirm, captureId, { token, body: theirCapture })).status).toBe(404);

    // My own receipt, aimed at their job or their client.
    const theirJob = await callRoute(receiptConfirm, mine.captureId, {
      token,
      body: { lines: [{ ...line, jobId: owner.jobId }] },
    });
    expect(theirJob.status).toBe(404);
    const theirClient = await callRoute(receiptConfirm, mine.captureId, {
      token,
      body: {
        lines: [{ ...line, jobId: "new:a" }],
        newJobs: [{ key: "a", title: "Sneaky", client: { id: owner.clientId } }],
      },
    });
    expect(theirClient.status).toBe(404);

    const db = getTestDb();
    expect(await db.select().from(lineItems).where(eq(lineItems.contractorId, owner.contractorId))).toHaveLength(0);
    expect(await db.select().from(jobs).where(eq(jobs.contractorId, other.contractorId))).toHaveLength(1);
    expect((await capturesFor(owner)).map((row) => row.status)).toEqual(["needs_review"]);
  });

  it("the web receipt route still notes the plan the same way", async () => {
    const tenant = await seedTenant("web-receipt-plan");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await upload(webReceipt, sameOrigin, { image: photo(), planId: "new" });
    const body = await res.json();
    const messages = await getTestDb().select().from(planMessages).where(eq(planMessages.planId, body.planId));
    expect(messages).toHaveLength(2);
  });
});

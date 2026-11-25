import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as voicePost } from "@/app/api/captures/voice/route";
import { POST as mobileTextPost } from "@/app/api/v1/captures/text/route";
import * as fake from "@/lib/ai/fake";
import type { PlanLoopClient } from "@/lib/ai/plan-loop";
import * as auth from "@/lib/auth";
import { captures, documents, lineItems, planMessages } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { createMobileSession } from "@/lib/mobile/sessions";
import { PLAN_NEW } from "@/lib/plans";
import { createInvoiceFromTrackedLines } from "@/lib/services/documents";
import { runPlanAgent } from "@/lib/services/plan-agent";
import { confirmPlanProposal, updatePlanProposalLines } from "@/lib/services/plan-proposals";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors, type TenantSeed } from "../helpers/seed";

const env = process.env;

beforeEach(() => {
  process.env.AI_PROVIDER = "fake";
  process.env.AI_FAKE_MODE = "ok";
});

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

const contractorOf = (tenant: TenantSeed) => ({ id: tenant.contractorId, labourRateHourly: 85 });

/** A model that makes these calls on its first step and stops when it sees the results. */
function scripted(calls: { name: string; args: unknown }[], seen?: string[]): PlanLoopClient {
  return {
    async complete(messages) {
      const results = messages.filter((message) => message.role === "tool");
      if (results.length) {
        seen?.push(...results.map((message) => message.content ?? ""));
        return { content: null, toolCalls: [] };
      }
      return { content: null, toolCalls: calls.map((call, index) => ({ id: String(index), name: call.name, arguments: JSON.stringify(call.args) })) };
    },
  };
}

async function addTrackedLabour(tenant: TenantSeed, quantity = 3) {
  await getTestDb()
    .insert(lineItems)
    .values({
      id: newId(),
      contractorId: tenant.contractorId,
      jobId: tenant.jobId,
      kind: "labour",
      description: "Labour",
      quantity,
      unit: "hr",
      unitPrice: 85,
      lineTotal: quantity * 85,
      sortOrder: 0,
      createdAt: Date.now(),
    });
}

describe("a greeting in front of a request", () => {
  it("drafts the request instead of replying with small talk", async () => {
    const tenant = await seedTenant("greet");
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), {
      text: "Hi, add 2 hours of labour",
      jobId: tenant.jobId,
    });
    expect(result.parts.map((part) => part.kind)).toEqual(["card"]);
    expect(result.preview?.action).toBe("log_hours");
  });
});

describe("a follow-up message", () => {
  it("can use a price the contractor gave earlier in the plan, and confirm writes it", async () => {
    const tenant = await seedTenant("follow");
    const db = getTestDb();
    const client = scripted([
      {
        name: "propose",
        args: { intent: "quote", job_title: "Job follow", lines: [{ kind: "material", description: "Water heater", quantity: 1, unit: "ea", unit_price: 780 }] },
      },
    ]);
    const result = await runPlanAgent(db, contractorOf(tenant), {
      text: "yes, make that a quote",
      history: [
        { role: "user", content: "the water heater for job follow is 780" },
        { role: "assistant", content: "Add these materials to Job follow" },
      ],
      client,
    });
    expect(result.preview?.blockers).toEqual([]);
    const confirmed = await confirmPlanProposal({ db, contractorId: tenant.contractorId }, result.captureId);
    expect(confirmed.kind).toBe("document");
    if (confirmed.kind !== "document") return;
    const [doc] = await db.select().from(documents).where(eq(documents.id, confirmed.documentId));
    expect(doc).toMatchObject({ type: "quote", subtotal: 780 });
  });

  it("still blocks a price nobody said", async () => {
    const tenant = await seedTenant("unsaid");
    const client = scripted([
      { name: "propose", args: { intent: "quote", job_title: "Job unsaid", lines: [{ kind: "material", description: "Heater", quantity: 1, unit: "ea", unit_price: 999 }] } },
    ]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), {
      text: "yes, make that a quote",
      history: [{ role: "user", content: "the water heater is 780" }],
      client,
    });
    expect(result.preview?.blockers).toContain("This price was not in what you said.");
  });
});

describe("invoicing the unbilled work from Plan", () => {
  it("bills the job's tracked lines once, and a second confirm opens the same invoice", async () => {
    const tenant = await seedTenant("tracked");
    const db = getTestDb();
    const ctx = { db, contractorId: tenant.contractorId };
    await addTrackedLabour(tenant);
    // A model that would retype the lines into a fresh invoice is never asked.
    const client: PlanLoopClient = {
      async complete() {
        throw new Error("The model should not be called for this message.");
      },
    };
    const result = await runPlanAgent(db, contractorOf(tenant), { text: "invoice job tracked for the unbilled work", client });
    expect(result.preview).toMatchObject({
      action: "invoice_tracked",
      canConfirm: true,
      lines: [{ description: "Labour", quantity: 3, unitPrice: 85 }],
    });

    await expect(
      updatePlanProposalLines(ctx, result.captureId, [{ description: "Labour", quantity: 30, unit: "hr", unitPrice: 85 }]),
    ).rejects.toThrow("Edit these lines on the job.");

    const first = await confirmPlanProposal(ctx, result.captureId);
    expect(first.kind).toBe("document");
    if (first.kind !== "document") return;
    const [invoice] = await db.select().from(documents).where(eq(documents.id, first.documentId));
    expect(invoice).toMatchObject({ type: "invoice", status: "draft", subtotal: 255, jobId: tenant.jobId });

    const unbilled = await db
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.jobId, tenant.jobId), isNull(lineItems.documentId), isNull(lineItems.billedDocumentId)));
    expect(unbilled).toHaveLength(0);

    expect(await confirmPlanProposal(ctx, result.captureId)).toEqual(first);
    const invoices = await db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId));
    expect(invoices).toHaveLength(1);
  });

  it("refuses to confirm once the lines were billed another way", async () => {
    const tenant = await seedTenant("raced");
    const db = getTestDb();
    const ctx = { db, contractorId: tenant.contractorId };
    await addTrackedLabour(tenant);
    const result = await runPlanAgent(db, contractorOf(tenant), { text: "invoice job raced for the unbilled work" });
    await createInvoiceFromTrackedLines(ctx, tenant.jobId);
    await expect(confirmPlanProposal(ctx, result.captureId)).rejects.toThrow("No unbilled tracked lines on this job.");
    expect(await db.select().from(documents).where(eq(documents.contractorId, tenant.contractorId))).toHaveLength(1);
  });

  it("says so when the job has nothing unbilled", async () => {
    const tenant = await seedTenant("nothing");
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "invoice job nothing for the unbilled work" });
    expect(result.parts).toEqual([{ kind: "text", body: "Job nothing has no unbilled work to invoice." }]);
  });

  it("never picks another contractor's job", async () => {
    const { a, b } = await seedTwoContractors();
    await addTrackedLabour(b);
    const result = await runPlanAgent(getTestDb(), contractorOf(a), { text: "invoice job B for the unbilled work" });
    expect(result.preview?.action).not.toBe("invoice_tracked");
  });
});

describe("a model call with a missing unit", () => {
  it("still becomes a card", async () => {
    const tenant = await seedTenant("unit");
    const client = scripted([{ name: "propose", args: { intent: "log", job_title: "Job unit", lines: [{ kind: "labour", description: "Labour", quantity: 2 }] } }]);
    const result = await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "log 2 hours on job unit", client });
    expect(result.preview).toMatchObject({ action: "log_hours", canConfirm: true, lines: [{ unit: "hr", unitPrice: 85 }] });
  });

  it("tells the model what to fix when a call cannot be used", async () => {
    const tenant = await seedTenant("fix");
    const seen: string[] = [];
    const client = scripted([{ name: "propose", args: { intent: "log", lines: [{ kind: "labour", description: "Labour", quantity: 0 }] } }], seen);
    await runPlanAgent(getTestDb(), contractorOf(tenant), { text: "log some hours on job fix", client });
    expect(seen[0]).toContain("lines.0.quantity");
  });
});

describe("the hourly limit", () => {
  it("does not count questions answered from the books", async () => {
    const tenant = await seedTenant("limit");
    const db = getTestDb();
    for (let index = 0; index < 30; index += 1) {
      await runPlanAgent(db, contractorOf(tenant), { text: "what quotes are on job limit?" });
    }
    const result = await runPlanAgent(db, contractorOf(tenant), { text: "add 2 hours of labour", jobId: tenant.jobId });
    expect(result.preview?.action).toBe("log_hours");
  });

  it("still stops model work after 30 captures", async () => {
    const tenant = await seedTenant("limited");
    const db = getTestDb();
    const now = Date.now();
    await db.insert(captures).values(
      Array.from({ length: 30 }, () => ({
        id: newId(),
        contractorId: tenant.contractorId,
        type: "text",
        status: "needs_review",
        extraction: { lines: [] },
        createdAt: now,
      })),
    );
    await expect(runPlanAgent(db, contractorOf(tenant), { text: "add 2 hours of labour", jobId: tenant.jobId })).rejects.toThrow(
      "hourly capture limit",
    );
  });
});

describe("voice uses the same agent as typed text", () => {
  const words = "Log 2 hours of labour and a valve at $45";

  async function sendVoice(tenant: TenantSeed, planId?: string) {
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    vi.spyOn(fake, "getTranscriptionProvider").mockReturnValue({ transcribe: async () => words });
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(2000)], "clip.webm", { type: "audio/webm" }));
    form.set("jobId", tenant.jobId);
    if (planId) form.set("planId", planId);
    return voicePost(new Request("http://localhost/api/captures/voice", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: form }));
  }

  it("splits hours and materials into two voice cards and saves both in the plan", async () => {
    const tenant = await seedTenant("voice");
    const db = getTestDb();
    const typed = await runPlanAgent(db, contractorOf(tenant), { text: words, jobId: tenant.jobId });

    const res = await sendVoice(tenant, PLAN_NEW);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe(words);
    expect(body.planId).toBeTruthy();

    const rows = await db
      .select()
      .from(captures)
      .where(and(eq(captures.contractorId, tenant.contractorId), eq(captures.type, "voice"), eq(captures.status, "needs_review")));
    const typedCards = typed.parts.filter((part) => part.kind === "card");
    expect(typedCards).toHaveLength(2);
    expect(rows).toHaveLength(typedCards.length);

    const thread = await db.select().from(planMessages).where(eq(planMessages.planId, body.planId));
    expect(thread.filter((row) => row.role === "user").map((row) => row.body)).toEqual([words]);
    expect(thread.filter((row) => row.role === "plan")).toHaveLength(2);
  });

  it("returns a failed voice capture with no transcript when transcription fails", async () => {
    const tenant = await seedTenant("deaf");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    vi.spyOn(fake, "getTranscriptionProvider").mockReturnValue({
      transcribe: async () => {
        throw new Error("provider down");
      },
    });
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(2000)], "clip.webm", { type: "audio/webm" }));
    const res = await voicePost(new Request("http://localhost/api/captures/voice", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: form }));
    const body = await res.json();
    expect(body.status).toBe("failed");
    const [row] = await getTestDb().select().from(captures).where(eq(captures.id, body.captureId));
    expect(row).toMatchObject({ type: "voice", status: "failed", transcript: null });
  });
});

describe("the phone uses the same agent as the web", () => {
  it("returns every card for a message that needs two", async () => {
    const tenant = await seedTenant("phone");
    const { token } = await createMobileSession(getTestDb(), tenant);
    const res = await mobileTextPost(
      new Request("http://localhost/api/v1/captures/text", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: "Log 2 hours of labour and a valve at $45", jobId: tenant.jobId }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(2);
    expect(body.cards.map((card: { preview: { action: string } }) => card.preview.action).sort()).toEqual(["add_materials", "log_hours"]);
    expect(body.captureId).toBe(body.cards[0].captureId);
  });
});

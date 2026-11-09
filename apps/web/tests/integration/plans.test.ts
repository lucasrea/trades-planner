import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postReceipt } from "@/app/api/captures/receipt/route";
import { POST as postText } from "@/app/api/captures/text/route";
import { POST as postVoice } from "@/app/api/captures/voice/route";
import * as auth from "@/lib/auth";
import { captures, planMessages, plans } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/services/context";
import { cancelPlanProposal, confirmPlanProposal } from "@/lib/services/plan-proposals";
import { getPlanThread, listPlans, recordPlanTurn } from "@/lib/services/plans";
import { getTestDb, getTestSql } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";

const env = process.env;

beforeEach(() => {
  process.env.AI_PROVIDER = "fake";
  process.env.AI_FAKE_MODE = "ok";
});

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

function send(tenant: { userId: string; contractorId: string }, body: unknown) {
  vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
  return postText(
    new Request("http://localhost/api/captures/text", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
      body: JSON.stringify(body),
    }),
  );
}

describe("saved plans", () => {
  it("enables row level security on both tables", async () => {
    const rows = await getTestSql()`SELECT relname FROM pg_class WHERE relname IN ('plans', 'plan_messages') AND relrowsecurity = true`;
    expect(rows.map((r) => r.relname).sort()).toEqual(["plan_messages", "plans"]);
  });

  it("first message creates a plan titled from it; the second joins it; both persist in order", async () => {
    const tenant = await seedTenant("plan-two");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };

    const first = await send(tenant, { text: "Add a valve at $45 to the kitchen", planId: "new" });
    expect(first.status).toBe(200);
    const { planId } = await first.json();
    expect(planId).toEqual(expect.any(String));

    const second = await send(tenant, { text: "Log 3 hours on the kitchen", planId });
    expect((await second.json()).planId).toBe(planId);

    const thread = await getPlanThread(ctx, planId);
    expect(thread.plan.title).toBe("Add these materials to kitchen");
    expect((await listPlans(ctx))[0]?.jobTitle).toBe("kitchen");
    expect(thread.messages.map((m) => [m.role, m.captureType])).toEqual([
      ["user", "text"],
      ["plan", "text"],
      ["user", "text"],
      ["plan", "text"],
    ]);
    expect(thread.messages[0].body).toBe("Add a valve at $45 to the kitchen");
    expect(thread.messages[1].outcome).toBe("waiting");
    expect(thread.messages[2].body).toBe("Log 3 hours on the kitchen");
    expect(await listPlans(ctx)).toHaveLength(1);
  });

  it("a message with no plan id writes no plan", async () => {
    const tenant = await seedTenant("plan-none");
    const res = await send(tenant, { text: "Add a valve at $45 to the kitchen" });
    expect((await res.json()).planId).toBeNull();
    expect(await listPlans({ db: getTestDb(), contractorId: tenant.contractorId })).toEqual([]);
  });

  it("new plan leaves the old one listed, newest first, with its own messages", async () => {
    const tenant = await seedTenant("plan-list");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const oldId = (await (await send(tenant, { text: "first plan message", planId: "new" })).json()).planId;
    const newerId = (await (await send(tenant, { text: "second plan message", planId: "new" })).json()).planId;
    expect(newerId).not.toBe(oldId);
    expect((await listPlans(ctx)).map((p) => p.id)).toEqual([newerId, oldId]);

    const old = await getPlanThread(ctx, oldId);
    expect(old.messages.filter((m) => m.role === "user").map((m) => m.body)).toEqual(["first plan message"]);

    await send(tenant, { text: "back in the first", planId: oldId });
    expect((await listPlans(ctx)).map((p) => p.id)).toEqual([oldId, newerId]);
  });

  it("shows cancelled and confirmed outcomes from the capture", async () => {
    const tenant = await seedTenant("kitchen");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    const planId = (await (await send(tenant, { text: "Add a valve at $45 to the kitchen", planId: "new" })).json()).planId;
    await send(tenant, { text: "Add a valve at $45 to the kitchen", planId });
    const rows = await getTestDb().select().from(planMessages).where(eq(planMessages.planId, planId));
    const captureIds = [...new Set(rows.map((r) => r.captureId!))];
    await cancelPlanProposal(ctx, captureIds[0]);
    await confirmPlanProposal(ctx, captureIds[1]);

    const outcomes = (await getPlanThread(ctx, planId)).messages.filter((m) => m.role === "plan").map((m) => m.outcome);
    expect(outcomes.sort()).toEqual(["cancelled", "confirmed"]);
  });

  it("another contractor's plan is not found and cannot be written to", async () => {
    const { a, b } = await seedTwoContractors();
    const planId = (await (await send(a, { text: "A's private plan", planId: "new" })).json()).planId;
    const ctxB = { db: getTestDb(), contractorId: b.contractorId };

    await expect(getPlanThread(ctxB, planId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listPlans(ctxB)).toEqual([]);

    const res = await send(b, { text: "sneaky", planId });
    expect(res.status).toBe(404);
    const captureCount = await getTestDb().select().from(captures).where(eq(captures.contractorId, b.contractorId));
    expect(captureCount).toHaveLength(0);
    await expect(
      recordPlanTurn(ctxB, { planId, userBody: "sneaky", replyBody: "x", captureId: "c" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const rows = await getTestDb().select().from(planMessages).where(eq(planMessages.planId, planId));
    expect(rows.every((r) => r.contractorId === a.contractorId)).toBe(true);
    const [plan] = await getTestDb().select().from(plans).where(eq(plans.id, planId));
    expect(plan.contractorId).toBe(a.contractorId);
  });

  it("voice and receipt join the plan: transcript and a one-line receipt note, no audio stored", async () => {
    const tenant = await seedTenant("plan-media");
    const ctx = { db: getTestDb(), contractorId: tenant.contractorId };
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });

    const voiceForm = new FormData();
    voiceForm.set("audio", new File([new Uint8Array([1, 2, 3])], "a.webm", { type: "audio/webm" }));
    voiceForm.set("planId", "new");
    const voice = await postVoice(
      new Request("http://localhost/api/captures/voice", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: voiceForm }),
    );
    expect(voice.status).toBe(200);
    const voiceBody = await voice.json();
    expect(voiceBody.planId).toEqual(expect.any(String));

    const receiptForm = new FormData();
    receiptForm.set("image", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3])], "r.jpg", { type: "image/jpeg" }));
    receiptForm.set("note", "add this to the kitchen");
    receiptForm.set("planId", voiceBody.planId);
    const receipt = await postReceipt(
      new Request("http://localhost/api/captures/receipt", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: receiptForm }),
    );
    expect(receipt.status).toBe(200);
    expect((await receipt.json()).planId).toBe(voiceBody.planId);

    const thread = await getPlanThread(ctx, voiceBody.planId);
    const user = thread.messages.filter((m) => m.role === "user");
    expect(user.map((m) => m.captureType)).toEqual(["voice", "receipt"]);
    expect(user[0].body).toBe(voiceBody.transcript);
    expect(user[1].body).toBe("Receipt photo: add this to the kitchen");
    expect(thread.messages.at(-1)?.preview).toBeNull();
  });
});

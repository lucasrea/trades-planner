import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PlanLoopClient } from "@/lib/ai/plan-loop";
import { jobs, lineItems } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { runPlanAgent } from "@/lib/services/plan-agent";
import { getTestDb } from "../helpers/db";
import { seedTwoContractors } from "../helpers/seed";

const env = process.env;

beforeEach(() => {
  process.env.AI_PROVIDER = "fake";
  process.env.AI_FAKE_MODE = "ok";
});

afterEach(() => {
  process.env = { ...env };
});

describe("plan agent lookup", () => {
  it("answers about the named job, not the open one, and only this contractor's jobs", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const now = Date.now();
    await db.insert(jobs).values({
      id: newId(),
      contractorId: a.contractorId,
      clientId: a.clientId,
      title: "Kitchen reno",
      status: "quoted",
      createdAt: now,
      updatedAt: now,
    });
    let looked = "";
    const client: PlanLoopClient = {
      async complete(messages) {
        const tool = [...messages].reverse().find((message) => message.role === "tool");
        if (tool) {
          looked = tool.content ?? "";
          return { content: null, toolCalls: [] };
        }
        return {
          content: null,
          toolCalls: [{ id: "1", name: "lookup", arguments: JSON.stringify({ what: "paperwork", job: "kitchen" }) }],
        };
      },
    };
    expect(b.contractorId).not.toBe(a.contractorId);
    await runPlanAgent(
      db,
      { id: a.contractorId, labourRateHourly: 85 },
      { text: "add a valve and what paperwork is on the kitchen", jobId: a.jobId, client },
    );
    const body = JSON.parse(looked) as { job: string; message: string };
    expect(body.job).toBe("Kitchen reno");
    expect(body.message).toContain("Quotes:");
    expect(body.message).not.toContain("Job A");
    expect(looked).not.toContain("Job B");
  });

  it("lists only this contractor when the model asks for jobs", async () => {
    const { a, b } = await seedTwoContractors();
    void b;
    const db = getTestDb();
    let looked = "";
    const client: PlanLoopClient = {
      async complete(messages) {
        const tool = [...messages].reverse().find((message) => message.role === "tool");
        if (tool) {
          looked = tool.content ?? "";
          return { content: null, toolCalls: [] };
        }
        return { content: null, toolCalls: [{ id: "1", name: "lookup", arguments: JSON.stringify({ what: "jobs" }) }] };
      },
    };
    await runPlanAgent(db, { id: a.contractorId, labourRateHourly: 85 }, { text: "add a note and list my jobs", client });
    expect(looked).toContain("Job A");
    expect(looked).not.toContain("Job B");
  });

  it("summarises unbilled work across all of this contractor's jobs when no job is named", async () => {
    const { a, b } = await seedTwoContractors();
    const db = getTestDb();
    const now = Date.now();
    await db.insert(lineItems).values([
      {
        id: newId(),
        contractorId: a.contractorId,
        jobId: a.jobId,
        kind: "labour",
        description: "Site work",
        quantity: 2,
        unit: "hr",
        unitPrice: 0,
        sortOrder: 0,
        createdAt: now,
      },
      {
        id: newId(),
        contractorId: b.contractorId,
        jobId: b.jobId,
        kind: "material",
        description: "Secret part",
        quantity: 1,
        unit: "ea",
        unitPrice: 999,
        sortOrder: 0,
        createdAt: now,
      },
    ]);

    const answered = await runPlanAgent(
      db,
      { id: a.contractorId, labourRateHourly: 85 },
      { text: "What unbilled work do I have?" },
    );
    expect(answered.reply).toContain("Unbilled work — $170.00 total");
    expect(answered.reply).toContain("Job A");
    expect(answered.reply).not.toContain("Job B");
    expect(answered.reply).not.toContain("Secret part");
  });
});

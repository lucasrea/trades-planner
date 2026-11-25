import { describe, expect, it } from "vitest";
import { fakeMixedProposes } from "@/lib/ai/fake-plan-client";
import { PlanLoopTimeoutError, runPlanLoop, type PlanLoopClient } from "@/lib/ai/plan-loop";
import { PLAN_TOOLS, parseProposeArgs, proposeArgsProblem, statusForTool } from "@/lib/ai/plan-tools";
import { parsePlanStreamLine } from "@/lib/http/plan-events";

describe("plan tool schema", () => {
  it("uses a single JSON type for every field so the API accepts the tools", () => {
    const types: unknown[] = [];
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      const record = value as { type?: unknown };
      if ("type" in record) types.push(record.type);
      Object.values(record).forEach(walk);
    };
    walk(PLAN_TOOLS);
    expect(
      types.every((type) => type === "object" || type === "string" || type === "number" || type === "boolean" || type === "array" || type === "function"),
    ).toBe(true);
  });
});

describe("statusForTool", () => {
  it("names the step from the tool the model chose", () => {
    expect(statusForTool("find_documents", JSON.stringify({ status: "open" }))).toBe("Checking quotes and invoices");
    expect(statusForTool("search_lines", JSON.stringify({ query: "water heater" }))).toBe("Checking past prices");
    expect(statusForTool("propose_send", JSON.stringify({ document_id: "d1" }))).toBe("Getting the email ready");
    expect(
      statusForTool("propose", JSON.stringify({ intent: "log", lines: [{ kind: "labour", description: "Labour", quantity: 5, unit: "hr", unit_price: null }] })),
    ).toBe("Drafting the hours");
    expect(
      statusForTool(
        "propose",
        JSON.stringify({ intent: "log", lines: [{ kind: "material", description: "valve", quantity: 1, unit: "ea", unit_price: 45 }] }),
      ),
    ).toBe("Drafting the materials");
    expect(statusForTool("reply", JSON.stringify({ text: "Hello" }))).toBe("Writing a reply");
  });
});

describe("runPlanLoop", () => {
  it("runs each tool the model asks for and stops when the model stops", async () => {
    const seen: string[] = [];
    const statuses: string[] = [];
    const client: PlanLoopClient = {
      async complete(messages) {
        if (messages.some((message) => message.role === "tool")) return { content: null, toolCalls: [] };
        return {
          content: null,
          toolCalls: [
            {
              id: "1",
              name: "propose",
              arguments: JSON.stringify({ intent: "log", lines: [{ kind: "labour", description: "Labour", quantity: 5, unit: "hr", unit_price: null }] }),
            },
            {
              id: "2",
              name: "propose",
              arguments: JSON.stringify({
                intent: "log",
                lines: [{ kind: "material", description: "valve", quantity: 1, unit: "ea", unit_price: 45 }],
              }),
            },
          ],
        };
      },
    };
    await runPlanLoop({
      client,
      contextNote: "Open job: kitchen",
      userText: "add 5 hours of labour and a valve at 45",
      execute: async (call) => {
        seen.push(call.name);
        return "{}";
      },
      onStatus: (text) => statuses.push(text),
    });
    expect(seen).toEqual(["propose", "propose"]);
    expect(statuses).toEqual(["Drafting the hours", "Drafting the materials"]);
  });

  it("runs at most six tool calls from one step", async () => {
    const seen: string[] = [];
    const client: PlanLoopClient = {
      async complete(messages) {
        if (messages.some((message) => message.role === "tool")) return { content: null, toolCalls: [] };
        return {
          content: null,
          toolCalls: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), name: "find_jobs", arguments: "{}" })),
        };
      },
    };
    await runPlanLoop({
      client,
      contextNote: "",
      userText: "list them",
      execute: async (call) => {
        seen.push(call.id);
        return "{}";
      },
    });
    expect(seen).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("stops after six model steps", async () => {
    let calls = 0;
    const client: PlanLoopClient = {
      async complete() {
        calls += 1;
        return { content: null, toolCalls: [{ id: String(calls), name: "find_jobs", arguments: "{}" }] };
      },
    };
    await runPlanLoop({
      client,
      contextNote: "",
      userText: "keep going",
      execute: async () => "{}",
    });
    expect(calls).toBe(6);
  });

  it("includes prior conversation history before the current message", async () => {
    let seenRoles: string[] = [];
    const client: PlanLoopClient = {
      async complete(messages) {
        seenRoles = messages.map((message) => `${message.role}:${message.content ?? ""}`);
        return { content: "All set.", toolCalls: [] };
      },
    };
    await runPlanLoop({
      client,
      contextNote: "Open job: none",
      userText: "for anything",
      history: [
        { role: "user", content: "What unbilled work do I have?" },
        { role: "assistant", content: "Which job?" },
      ],
      execute: async () => "{}",
    });
    expect(seenRoles[1]).toBe("user:What unbilled work do I have?");
    expect(seenRoles[2]).toBe("assistant:Which job?");
    expect(seenRoles[3]).toContain("Message:\nfor anything");
  });
});

describe("fake mixed proposes", () => {
  it("asks for the hours and the material as two cards", () => {
    const calls = fakeMixedProposes("add 5 hours of labour and a valve at 45");
    expect(calls).toHaveLength(2);
    expect(calls?.map((call) => call.name)).toEqual(["propose", "propose"]);
  });

  it("leaves a single request as one extraction", () => {
    expect(fakeMixedProposes("Add a valve at $45 to the kitchen")).toBeNull();
    expect(fakeMixedProposes("Log 3 hours on the kitchen")).toBeNull();
  });
});

describe("plan stream events", () => {
  it("reads a status line and a done line", () => {
    expect(parsePlanStreamLine('{"type":"status","text":"Drafting the hours"}')).toEqual({
      type: "status",
      text: "Drafting the hours",
    });
    expect(parsePlanStreamLine("")).toBeNull();
  });
});

describe("propose arguments", () => {
  it("fills in a missing unit and missing lines instead of dropping the card", () => {
    const parsed = parseProposeArgs(
      JSON.stringify({ intent: "log", lines: [{ kind: "labour", description: "Labour", quantity: 2 }, { kind: "material", description: "Valve", quantity: "1", unit: "" }] }),
    );
    expect(parsed?.lines.map((line) => line.unit)).toEqual(["hr", "ea"]);
    expect(parseProposeArgs(JSON.stringify({ intent: "log", job_title: "Deck" }))?.lines).toEqual([]);
  });

  it("tells the model what was wrong so it can send the call again", () => {
    expect(proposeArgsProblem(JSON.stringify({ intent: "log", lines: [{ kind: "labour", description: "Labour", quantity: 0 }] }))).toMatch(/^lines\.0\.quantity:/);
    expect(proposeArgsProblem("{not json")).toBe("The arguments were not valid JSON.");
  });
});

describe("runPlanLoop resilience", () => {
  it("retries one step after a provider error that is worth retrying", async () => {
    let calls = 0;
    const client: PlanLoopClient = {
      async complete() {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("Internal error"), { status: 500 });
        return { content: "Done.", toolCalls: [] };
      },
    };
    const replies: string[] = [];
    await runPlanLoop({ client, contextNote: "", userText: "x", execute: async (call) => (replies.push(call.arguments), "{}") });
    expect(calls).toBe(2);
    expect(replies).toHaveLength(1);
  });

  it("does not retry a request the provider rejected", async () => {
    let calls = 0;
    const client: PlanLoopClient = {
      async complete() {
        calls += 1;
        throw Object.assign(new Error("Invalid schema"), { status: 400 });
      },
    };
    await expect(runPlanLoop({ client, contextNote: "", userText: "x", execute: async () => "{}" })).rejects.toThrow("Invalid schema");
    expect(calls).toBe(1);
  });

  it("stops inside its time budget when the model hangs", async () => {
    const client: PlanLoopClient = {
      complete: (_messages, signal) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    };
    const started = Date.now();
    await expect(
      runPlanLoop({ client, contextNote: "", userText: "x", execute: async () => "{}", budgetMs: 300, stepTimeoutMs: 200 }),
    ).rejects.toBeInstanceOf(PlanLoopTimeoutError);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("does not start another step once the budget is spent", async () => {
    let calls = 0;
    const client: PlanLoopClient = {
      async complete() {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 120));
        return { content: null, toolCalls: [{ id: String(calls), name: "find_jobs", arguments: "{}" }] };
      },
    };
    await expect(
      runPlanLoop({ client, contextNote: "", userText: "x", execute: async () => "{}", budgetMs: 200, stepTimeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(PlanLoopTimeoutError);
    expect(calls).toBeLessThanOrEqual(2);
  });
});

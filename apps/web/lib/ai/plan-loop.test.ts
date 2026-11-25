import { describe, expect, it } from "vitest";
import { fakeMixedProposes } from "@/lib/ai/fake-plan-client";
import { runPlanLoop, type PlanLoopClient } from "@/lib/ai/plan-loop";
import { statusForTool } from "@/lib/ai/plan-tools";
import { parsePlanStreamLine } from "@/lib/http/plan-events";

describe("statusForTool", () => {
  it("names the step from the tool the model chose", () => {
    expect(statusForTool("lookup", JSON.stringify({ what: "unbilled", job: "kitchen" }))).toBe("Checking unbilled work on kitchen");
    expect(statusForTool("lookup", JSON.stringify({ what: "paperwork", job: "kitchen" }))).toBe(
      "Checking quotes and invoices on kitchen",
    );
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

  it("stops after four model steps", async () => {
    let calls = 0;
    const client: PlanLoopClient = {
      async complete() {
        calls += 1;
        return { content: null, toolCalls: [{ id: String(calls), name: "lookup", arguments: JSON.stringify({ what: "jobs" }) }] };
      },
    };
    await runPlanLoop({
      client,
      contextNote: "",
      userText: "keep going",
      execute: async () => "{}",
    });
    expect(calls).toBe(4);
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

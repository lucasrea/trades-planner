import { describe, expect, it } from "vitest";
import { runPlanLoop, type PlanLoopClient, type PlanStepOptions } from "@/lib/ai/plan-loop";
import { PLAN_TOOL_NAMES, parseToolArgs, toolName } from "@/lib/ai/plan-tools";
import { changeHref, parsePlanChange } from "@/lib/plan-changes";
import { dateRangeMs, documentStatusFilter, localDate, localMidnightMs, periodStart } from "@/lib/plan-lookup";
import { messageAsksForWork } from "@/lib/plan-message";
import { sumMoney } from "@/lib/money";

describe("status words", () => {
  it("maps the contractor's words onto statuses the app owns", () => {
    expect(documentStatusFilter("quote", "open")).toEqual({ type: "quote", statuses: ["draft", "sent"], overdueOnly: false });
    expect(documentStatusFilter("quote", "waiting")).toEqual({ type: "quote", statuses: ["sent"], overdueOnly: false });
    expect(documentStatusFilter(null, "unpaid")).toEqual({ type: "invoice", statuses: ["sent"], overdueOnly: false });
    expect(documentStatusFilter(null, "overdue")).toEqual({ type: "invoice", statuses: ["sent"], overdueOnly: true });
    expect(documentStatusFilter("invoice", "approved")).toEqual({ type: "quote", statuses: ["approved"], overdueOnly: false });
    expect(documentStatusFilter(undefined, undefined)).toEqual({ type: null, statuses: null, overdueOnly: false });
  });
});

describe("the contractor's day", () => {
  it("uses Toronto time, including across daylight saving", () => {
    // 2026-11-25 03:00 UTC is still 2026-11-24 in Toronto.
    expect(localDate(Date.UTC(2026, 10, 25, 3))).toBe("2026-11-24");
    expect(localMidnightMs("2026-01-15")).toBe(Date.UTC(2026, 0, 15, 5));
    expect(localMidnightMs("2026-07-15")).toBe(Date.UTC(2026, 6, 15, 4));
    expect(localMidnightMs("not a date")).toBeNull();
  });

  it("makes `until` include the whole day", () => {
    const range = dateRangeMs("2026-07-01", "2026-07-01");
    expect(range.to! - range.from!).toBe(24 * 60 * 60 * 1000);
  });

  it("starts a week on Monday and a month on the 1st", () => {
    expect(periodStart("week", "2026-11-25")).toBe("2026-11-23");
    expect(periodStart("week", "2026-11-23")).toBe("2026-11-23");
    expect(periodStart("month", "2026-11-25")).toBe("2026-11-01");
    expect(periodStart("today", "2026-11-25")).toBe("2026-11-25");
  });
});

describe("tool arguments", () => {
  it("has a schema for every tool the model is offered", () => {
    expect(PLAN_TOOL_NAMES).toHaveLength(17);
    for (const name of PLAN_TOOL_NAMES) expect(toolName(name)).toBe(name);
    expect(toolName("propose")).toBe("propose_work");
    expect(toolName("lookup")).toBeNull();
  });

  it("reads 'false' as false", () => {
    const parsed = parseToolArgs("propose_send", JSON.stringify({ document_id: "d1", reminder: "false" }));
    expect(parsed.ok && parsed.args.reminder).toBe(false);
  });

  it("needs exactly one thing to invoice", () => {
    expect(parseToolArgs("propose_invoice", JSON.stringify({})).ok).toBe(false);
    expect(parseToolArgs("propose_invoice", JSON.stringify({ job_id: "j", quote_id: "q" })).ok).toBe(false);
    expect(parseToolArgs("propose_invoice", JSON.stringify({ quote_id: "q" })).ok).toBe(true);
  });

  it("explains a bad date so the model can resend it", () => {
    const parsed = parseToolArgs("find_documents", JSON.stringify({ since: "last week" }));
    expect(parsed.ok ? "" : parsed.problem).toBe("since: Use YYYY-MM-DD.");
  });
});

describe("change cards", () => {
  it("only stores changes that are complete", () => {
    expect(parsePlanChange({ kind: "document_status", document_id: "d1", to: "paid" })).not.toBeNull();
    expect(parsePlanChange({ kind: "document_status", document_id: "d1", to: "deleted" })).toBeNull();
    expect(parsePlanChange({ kind: "move_lines", job_id: "a", to_job_id: "b", line_ids: [] })).toBeNull();
    expect(parsePlanChange({ kind: "settings", tax_rate_pct: 45 })).toBeNull();
  });

  it("links each change to where the contractor would look", () => {
    expect(changeHref({ kind: "document_status", document_id: "d1", to: "paid" })).toBe("/app/documents/d1");
    expect(changeHref({ kind: "move_lines", job_id: "a", to_job_id: "b", line_ids: ["l"] })).toBe("/app/jobs/b");
    expect(changeHref({ kind: "settings", labour_rate: 90 })).toBe("/app/settings");
  });
});

describe("messageAsksForWork", () => {
  it("tells a request for work from a question about the books", () => {
    expect(messageAsksForWork("add 3 hours to the deck")).toBe(true);
    expect(messageAsksForWork("invoice Chen")).toBe(true);
    expect(messageAsksForWork("for all of them")).toBe(false);
    expect(messageAsksForWork("what about that one")).toBe(false);
  });
});

describe("sumMoney", () => {
  it("rounds a sum to cents", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([99.99, 99.99, 99.99])).toBe(299.97);
    expect(sumMoney([])).toBe(0);
  });
});

describe("the final step", () => {
  it("is skipped when the turn already has output", async () => {
    const asked: (PlanStepOptions | undefined)[] = [];
    const client: PlanLoopClient = {
      async complete(_messages, _signal, options) {
        asked.push(options);
        return { content: "Here you go.", toolCalls: [] };
      },
    };
    let output = false;
    await runPlanLoop({
      client,
      contextNote: "",
      userText: "hi",
      execute: async () => {
        output = true;
        return "{}";
      },
      hasOutput: () => output,
    });
    expect(asked).toEqual([undefined]);
  });

  it("refuses any tool but reply and ask in the final step", async () => {
    const ran: string[] = [];
    let step = 0;
    const client: PlanLoopClient = {
      async complete(_messages, _signal, options) {
        step += 1;
        if (!options) return { content: null, toolCalls: [] };
        return {
          content: null,
          toolCalls: [
            { id: "x", name: "propose_settings", arguments: JSON.stringify({ labour_rate: 1 }) },
            { id: "y", name: "reply", arguments: JSON.stringify({ text: "Which job?" }) },
          ],
        };
      },
    };
    await runPlanLoop({ client, contextNote: "", userText: "hm", execute: async (call) => (ran.push(call.name), "{}"), hasOutput: () => ran.length > 0 });
    expect(step).toBe(2);
    expect(ran).toEqual(["reply"]);
  });
});

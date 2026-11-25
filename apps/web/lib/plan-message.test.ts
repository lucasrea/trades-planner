import { describe, expect, it } from "vitest";
import { classifyPlanMessage, formatJobPaperwork, messageAsksToInvoice, messageAsksToQuote } from "@/lib/plan-message";

describe("classifyPlanMessage", () => {
  it("treats a paperwork question as a question", () => {
    expect(classifyPlanMessage("what invoices and quotes are drafted for the kitchen job")).toBe("question");
    expect(classifyPlanMessage("How many quotes are on the kitchen?")).toBe("question");
  });

  it("treats add, log, quote, and invoice as actions", () => {
    expect(classifyPlanMessage("add a valve at 45 to the kitchen")).toBe("act");
    expect(classifyPlanMessage("Quote the kitchen for a valve at 45")).toBe("act");
    expect(classifyPlanMessage("invoice the kitchen")).toBe("act");
  });

  it("treats a greeting as chat", () => {
    expect(classifyPlanMessage("hey, how's it going")).toBe("chat");
  });
});

describe("message billing words", () => {
  it("only treats bill, charge, and invoice as a request to invoice", () => {
    expect(messageAsksToInvoice("add a valve to the kitchen")).toBe(false);
    expect(messageAsksToInvoice("invoice the kitchen")).toBe(true);
    expect(messageAsksToQuote("quote the kitchen")).toBe(true);
  });
});

describe("formatJobPaperwork", () => {
  it("lists quotes and invoices on the named job", () => {
    expect(
      formatJobPaperwork({
        jobTitle: "Kitchen",
        jobNames: ["Kitchen"],
        documents: [
          { type: "quote", number: "Q-0004", status: "draft" },
          { type: "invoice", number: "INV-0002", status: "sent" },
        ],
      }),
    ).toBe("Kitchen\nQuotes: Q-0004 draft\nInvoices: INV-0002 sent");
  });

  it("asks which job when none was named", () => {
    expect(formatJobPaperwork({ jobTitle: null, jobNames: ["Kitchen", "Bath"], documents: [] })).toBe(
      "Which job? I see Kitchen, Bath.",
    );
  });
});

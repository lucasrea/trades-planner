import { describe, expect, it } from "vitest";
import { asksToInvoiceTrackedWork, classifyPlanMessage, formatJobPaperwork, messageAsksToInvoice, messageAsksToQuote, parseCompoundWork, parseObviousAct, stripGreeting } from "@/lib/plan-message";

describe("classifyPlanMessage", () => {
  it("treats a paperwork question as a question", () => {
    expect(classifyPlanMessage("what invoices and quotes are drafted for the kitchen job")).toBe("question");
    expect(classifyPlanMessage("How many quotes are on the kitchen?")).toBe("question");
    expect(classifyPlanMessage("What unbilled work do I have?")).toBe("question");
    expect(classifyPlanMessage("for all jobs, what unbilled work do i have")).toBe("question");
  });

  it("treats add, log, quote, and invoice as actions", () => {
    expect(classifyPlanMessage("add a valve at 45 to the kitchen")).toBe("act");
    expect(classifyPlanMessage("Quote the kitchen for a valve at 45")).toBe("act");
    expect(classifyPlanMessage("invoice the kitchen")).toBe("act");
  });

  it("treats a greeting as chat", () => {
    expect(classifyPlanMessage("hey, how's it going")).toBe("chat");
  });

  it("keeps ordinary work notes as actions", () => {
    expect(classifyPlanMessage("3 hours at the Smith place")).toBe("act");
    expect(classifyPlanMessage("valve at 45 for the kitchen")).toBe("act");
    expect(classifyPlanMessage("Can you add a valve to the kitchen?")).toBe("act");
  });
});

describe("parseObviousAct", () => {
  it("reads hours of labour", () => {
    expect(parseObviousAct("add 5 hours of labour")?.lines[0]).toMatchObject({
      kind: "labour",
      quantity: 5,
      unit: "hr",
      unit_price: null,
    });
    expect(parseObviousAct("add 5 hours of labour to the job too")?.lines[0]?.quantity).toBe(5);
  });

  it("leaves mixed or quoted work for the model", () => {
    expect(parseObviousAct("quote 5 hours of labour and a tank")).toBeNull();
    expect(parseObviousAct("add 5 hours of labour and a valve at 45")).toBeNull();
    expect(parseObviousAct("add 5 hours of labour to the Chen job and add a valve at 45")).toBeNull();
    expect(parseObviousAct("add 5 hours of labour to the job at 90")).toBeNull();
    expect(parseObviousAct("add 5 hours of labour to the job. Also add a tank at 45")).toBeNull();
  });

  it("splits hours and a sink with a dollar markup", () => {
    const parts = parseCompoundWork(
      "we need 4 hours of labour and adding the kitchen sink which cost me 500, put it in for a +150 markup",
    );
    expect(parts?.[0]?.lines[0]).toMatchObject({ kind: "labour", quantity: 4, unit_price: null });
    expect(parts?.[1]?.lines[0]).toMatchObject({
      kind: "material",
      description: "kitchen sink",
      unit_cost: 500,
      unit_price: 650,
    });
  });

  it("leaves an unrecognised markup or an extra priced item for the model", () => {
    const sink = "we need 4 hours of labour and adding the sink which cost me 500";
    expect(parseCompoundWork(`${sink}, put it in for a 20% markup`)).toBeNull();
    expect(parseCompoundWork(`${sink} with a $150 markup`)).toBeNull();
    expect(parseCompoundWork(`${sink}, markup of 150`)).toBeNull();
    expect(parseCompoundWork(`${sink}, put it in for a +150 markup and also add a tank at 45`)).toBeNull();
    expect(parseCompoundWork(`${sink}, put it in for a +150 markup on the quote`)).toBeNull();
  });

  it("reads a cost with the dollar sign after the number", () => {
    expect(parseObviousAct("need to add an expense, new granite countertops costing 2000$")?.lines[0]).toMatchObject({
      kind: "material",
      description: "granite countertops",
      quantity: 1,
      unit_price: 2000,
    });
  });
});

describe("message billing words", () => {
  it("only treats bill, charge, and invoice as a request to invoice", () => {
    expect(messageAsksToInvoice("add a valve to the kitchen")).toBe(false);
    expect(messageAsksToInvoice("invoice the kitchen")).toBe(true);
    expect(messageAsksToInvoice("add a valve to Bill's kitchen")).toBe(false);
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

describe("greetings in front of a request", () => {
  it("handles the request instead of answering with small talk", () => {
    expect(classifyPlanMessage("Hi, quote Patel for a water heater, the tank is 780")).toBe("act");
    expect(classifyPlanMessage("Thanks! Invoice Chen for the valve")).toBe("act");
    expect(classifyPlanMessage("hey there, what quotes are on the kitchen?")).toBe("question");
    expect(classifyPlanMessage("OK log 3 hours on the deck")).toBe("act");
  });

  it("still treats a greeting on its own, or with pleasantries, as small talk", () => {
    expect(classifyPlanMessage("Hi")).toBe("chat");
    expect(classifyPlanMessage("thanks so much!")).toBe("chat");
    expect(classifyPlanMessage("Thanks for the help")).toBe("chat");
    expect(classifyPlanMessage("good morning, how are you")).toBe("chat");
  });
});

describe("asksToInvoiceTrackedWork", () => {
  it("recognises billing for work already on the job", () => {
    expect(asksToInvoiceTrackedWork("invoice the kitchen for the unbilled work")).toBe(true);
    expect(asksToInvoiceTrackedWork("bill Chen for what I logged")).toBe(true);
    expect(asksToInvoiceTrackedWork("Invoice everything on the deck job")).toBe(true);
  });

  it("leaves new work, questions about unbilled work and quotes alone", () => {
    expect(asksToInvoiceTrackedWork("invoice Chen for 3 hours I logged today")).toBe(false);
    expect(asksToInvoiceTrackedWork("what unbilled work do I have?")).toBe(false);
    expect(asksToInvoiceTrackedWork("quote the unbilled work on the kitchen")).toBe(false);
    expect(asksToInvoiceTrackedWork("invoice Chen for the valve")).toBe(false);
  });
});

describe("plain adds behind a greeting", () => {
  it("are still read without the model", () => {
    expect(parseObviousAct("Hi, add 2 hours of labour")?.lines[0]).toMatchObject({ kind: "labour", quantity: 2 });
    expect(stripGreeting("Thanks! log 3 hours of labour")).toBe("log 3 hours of labour");
    expect(stripGreeting("Hiking trail repair")).toBe("Hiking trail repair");
  });
});

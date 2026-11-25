import { describe, expect, it } from "vitest";
import {
  describeToDraft,
  fuzzyMatchClient,
  matchJobInText,
  receiptConfirmBlockers,
  receiptToDraft,
  receiptWarnings,
  sumLines,
  toLineRow,
  validateLine,
} from "@/lib/line-items";

describe("line-items", () => {
  it("validates and totals lines", () => {
    const base = { kind: "material" as const, description: "Pipe", quantity: 1, unit: "ea", unitPrice: 10 };
    expect(validateLine(base)).toEqual([]);
    expect(toLineRow({ ...base, quantity: 3, unitPrice: 0.1 }).lineTotal).toBe(0.3);
    expect(sumLines([toLineRow(base), toLineRow({ ...base, unitPrice: 0.2 })])).toBe(10.2);
  });

  it("describeToDraft applies labour default rate", () => {
    const lines = describeToDraft(
      {
        lines: [{ kind: "labour", description: "Work", quantity: 2, unit: "hr", unit_price: null }],
      },
      { labourRate: 85 },
    );
    expect(lines[0]?.unitPrice).toBe(85);
    expect(lines[0]?.defaultRate).toBe(true);
  });

  it("describeToDraft skips labour default when the transcript named a price", () => {
    const lines = describeToDraft(
      {
        lines: [{ kind: "labour", description: "Work", quantity: 1, unit: "hr", unit_price: null }],
      },
      { labourRate: 85, statedPriceInTranscript: true },
    );
    expect(lines[0]?.unitPrice).toBeNull();
    expect(lines[0]?.defaultRate).toBe(false);
  });

  it("receipt helpers warn and markup", () => {
    const extraction = {
      subtotal: 10,
      lines: [{ description: "A", quantity: 2, unit_price: 5, line_total: 10 }],
    };
    expect(receiptWarnings(extraction)).toEqual([]);
    const draft = receiptToDraft(extraction, { markupPct: 20 });
    expect(draft[0]?.unitCost).toBe(5);
    expect(draft[0]?.unitPrice).toBe(6);
  });

  it("blocks confirm when a receipt line or subtotal does not match the print", () => {
    const line = { description: "Valve", quantity: 2, unitCost: 4, printedLineTotal: 25 };
    expect(receiptConfirmBlockers({ subtotal: 25, lines: [line] })).toEqual([
      '"Valve" does not match the printed line total.',
      "Line totals do not match the receipt subtotal.",
    ]);
    expect(
      receiptConfirmBlockers({
        subtotal: 25,
        lines: [{ description: "Valve", quantity: 2, unitCost: 12.5, printedLineTotal: 25 }],
      }),
    ).toEqual([]);
  });

  it("fuzzyMatchClient matches normalized names", () => {
    expect(fuzzyMatchClient("Mrs. Patel", [{ id: "1", name: "Patel, Maria" }])?.id).toBe("1");
    expect(fuzzyMatchClient("Totally Different", [{ id: "1", name: "Patel" }])).toBeNull();
  });

  it("matchJobInText finds the one job the note names", () => {
    const jobs = [
      { id: "k", title: "Kitchen remodel" },
      { id: "b", title: "Bathroom repair" },
    ];
    expect(matchJobInText("add this to the kitchen", jobs)).toBe("k");
    expect(matchJobInText("Bathroom Repair please", jobs)).toBe("b");
    expect(matchJobInText("these are for the garage", jobs)).toBeNull();
    expect(matchJobInText("", jobs)).toBeNull();
  });

  it("matchJobInText refuses to guess on a tie or on filler words", () => {
    const jobs = [
      { id: "1", title: "Smith kitchen" },
      { id: "2", title: "Jones kitchen" },
    ];
    expect(matchJobInText("add this to the kitchen", jobs)).toBeNull();
    expect(matchJobInText("add this to the Smith kitchen", jobs)).toBe("1");
    expect(matchJobInText("add this to the job", [{ id: "x", title: "The job" }])).toBeNull();
  });
});

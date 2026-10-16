import { describe, expect, it } from "vitest";
import {
  describeToDraft,
  fuzzyMatchClient,
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

  it("fuzzyMatchClient matches normalized names", () => {
    expect(fuzzyMatchClient("Mrs. Patel", [{ id: "1", name: "Patel, Maria" }])?.id).toBe("1");
    expect(fuzzyMatchClient("Totally Different", [{ id: "1", name: "Patel" }])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { computeTotals, lineTotal, padNumber, roundMoney } from "@/lib/money";

describe("money helpers", () => {
  it("rounds currency to two decimal places", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.999)).toBe(11);
  });

  it("computes categorized totals and tax", () => {
    const totals = computeTotals(
      [
        {
          id: "material",
          kind: "material",
          description: "PEX",
          quantity: 3,
          unit: "ft",
          unitPrice: 1.25,
        },
        {
          id: "labour",
          kind: "labour",
          description: "Install",
          quantity: 2,
          unit: "hr",
          unitPrice: 85,
        },
        {
          id: "other",
          kind: "other",
          description: "Permit",
          quantity: 1,
          unit: "ea",
          unitPrice: 50,
        },
      ],
      0.13,
    );

    expect(totals).toEqual({
      materials: 3.75,
      labour: 170,
      other: 50,
      subtotal: 223.75,
      tax: 29.09,
      total: 252.84,
    });
  });

  it("handles invalid numeric values defensively", () => {
    expect(
      lineTotal({
        id: "line",
        kind: "material",
        description: "Invalid",
        quantity: Number.NaN,
        unit: "ea",
        unitPrice: 10,
      }),
    ).toBe(0);
  });

  it("formats sequential document numbers", () => {
    expect(padNumber(42, "Q")).toBe("Q-0042");
    expect(padNumber(7, "INV")).toBe("INV-0007");
  });
});

import { describe, expect, it } from "vitest";
import {
  applyMarkup,
  computeTotals,
  documentTotals,
  lineTotal,
  matchingTaxPercentCaption,
  padNumber,
  roundMoney,
  storedTaxPercent,
} from "@/lib/money";

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

  it("applies a percentage markup to a cost", () => {
    expect(applyMarkup(100, 20)).toBe(120);
    expect(applyMarkup(89.5, 20)).toBe(107.4);
    expect(applyMarkup(10, 0)).toBe(10);
  });

  it("returns only persisted document totals", () => {
    const totals = documentTotals(
      [
        {
          id: "material",
          kind: "material",
          description: "PEX",
          quantity: 2,
          unit: "ft",
          unitPrice: 5,
        },
      ],
      0.13,
    );

    expect(totals).toEqual({ subtotal: 10, tax: 1.3, total: 11.3 });
    expect(storedTaxPercent(10, 1.3)).toBe(13);
    expect(storedTaxPercent(0, 0)).toBeNull();
    expect(matchingTaxPercentCaption(0.13, 10, 1.3)).toBe("13%");
    expect(matchingTaxPercentCaption(0.13, 3.33, 0.43)).toBeNull();
  });
});

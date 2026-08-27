import { describe, expect, it } from "vitest";
import {
  defaultSellPrice,
  jobCostLineTotal,
  jobCostToDraftLine,
  jobCostToInvoiceKind,
} from "@/lib/job-costs";

describe("job costs", () => {
  it("maps expenses to invoice other lines", () => {
    expect(jobCostToInvoiceKind("material")).toBe("material");
    expect(jobCostToInvoiceKind("labour")).toBe("labour");
    expect(jobCostToInvoiceKind("expense")).toBe("other");
  });

  it("uses markup for materials and expenses, labour rate for labour", () => {
    const rates = { markupPct: 20, labourRate: 85, applyMarkup: true };
    expect(defaultSellPrice("material", 100, rates)).toBe(120);
    expect(defaultSellPrice("expense", 50, rates)).toBe(60);
    expect(defaultSellPrice("labour", 0, rates)).toBe(85);
    expect(defaultSellPrice("material", 100, { ...rates, applyMarkup: false })).toBe(100);
  });

  it("builds invoice draft lines from job costs", () => {
    expect(
      jobCostToDraftLine({
        id: "c1",
        kind: "expense",
        description: "Dump fee",
        quantity: 1,
        unit: "ea",
        cost: 40,
        unitPrice: 48,
      }),
    ).toEqual({
      id: "c1",
      kind: "other",
      description: "Dump fee",
      quantity: 1,
      unit: "ea",
      unitPrice: 48,
    });
    expect(jobCostLineTotal({ quantity: 2, unitPrice: 12.5 })).toBe(25);
  });
});

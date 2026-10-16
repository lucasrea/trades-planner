import { describe, expect, it } from "vitest";
import { sumLines, toLineRow, validateLine } from "@/lib/line-items";

describe("line-items", () => {
  it("validates and totals lines", () => {
    const base = { kind: "material" as const, description: "Pipe", quantity: 1, unit: "ea", unitPrice: 10 };
    expect(validateLine(base)).toEqual([]);
    expect(toLineRow({ ...base, quantity: 3, unitPrice: 0.1 }).lineTotal).toBe(0.3);
    expect(sumLines([toLineRow(base), toLineRow({ ...base, unitPrice: 0.2 })])).toBe(10.2);
  });
});

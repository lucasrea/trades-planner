import { describe, expect, it } from "vitest";
import { transcriptNamesPrice } from "@/lib/plan-stated-price";

describe("transcriptNamesPrice", () => {
  it("matches dollar sign, dollars, and at-plus-number", () => {
    expect(transcriptNamesPrice("Labour at $80")).toBe(true);
    expect(transcriptNamesPrice("80 dollars for the valve")).toBe(true);
    expect(transcriptNamesPrice("Log 1 hour at 80")).toBe(true);
    expect(transcriptNamesPrice("Log 1 hour at 80 dollars")).toBe(true);
  });

  it("does not treat hours or bare quantities as prices", () => {
    expect(transcriptNamesPrice("Log 1 hour on the kitchen")).toBe(false);
    expect(transcriptNamesPrice("four hours on site")).toBe(false);
    expect(transcriptNamesPrice("add two valves")).toBe(false);
    expect(transcriptNamesPrice("at 1 hour")).toBe(false);
    expect(transcriptNamesPrice(null)).toBe(false);
    expect(transcriptNamesPrice("")).toBe(false);
  });
});

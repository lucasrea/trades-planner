import { describe, expect, it } from "vitest";
import { priceAppearsInTranscript, transcriptNamesPrice } from "@/lib/plan-stated-price";

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

  it("matches a price only when those digits appear", () => {
    expect(priceAppearsInTranscript("a valve at $45", 45)).toBe(true);
    expect(priceAppearsInTranscript("a valve at 45.00", 45)).toBe(true);
    expect(priceAppearsInTranscript("tank is $1,265.60", 1265.6)).toBe(true);
    expect(priceAppearsInTranscript("add a valve", 45)).toBe(false);
    expect(priceAppearsInTranscript("450 fittings", 45)).toBe(false);
    expect(priceAppearsInTranscript("Log 1 hour on the kitchen", 85)).toBe(false);
  });
});

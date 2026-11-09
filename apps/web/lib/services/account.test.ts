import { describe, expect, it } from "vitest";
import { businessNameMatches } from "@/lib/services/account";

describe("businessNameMatches", () => {
  it("matches ignoring case and surrounding space", () => {
    expect(businessNameMatches("Rea Plumbing", "  rea plumbing ")).toBe(true);
  });
  it("rejects a different name", () => {
    expect(businessNameMatches("Rea Plumbing", "Rea")).toBe(false);
    expect(businessNameMatches("Rea Plumbing", "")).toBe(false);
  });
  it("never matches when the business has no name", () => {
    expect(businessNameMatches("", "")).toBe(false);
    expect(businessNameMatches("  ", "  ")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isTokenShape, newToken } from "@/lib/id";

describe("share tokens", () => {
  it("are 32 url-safe characters and do not repeat", () => {
    const tokens = Array.from({ length: 500 }, () => newToken());
    expect(tokens.every((t) => isTokenShape(t))).toBe(true);
    expect(new Set(tokens).size).toBe(500);
  });

  it("rejects values that are not tokens", () => {
    for (const value of ["", "abc", "a".repeat(31), "a".repeat(33), `${"a".repeat(31)}/`, `${"a".repeat(31)} `]) {
      expect(isTokenShape(value)).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { hashMobileBearer } from "@/lib/mobile/sessions";

describe("hashMobileBearer", () => {
  it("is SHA-256 hex", () => {
    const hash = hashMobileBearer("test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashMobileBearer("test-token"));
    expect(hash).not.toBe(hashMobileBearer("other"));
  });
});

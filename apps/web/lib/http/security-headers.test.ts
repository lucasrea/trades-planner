import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/http/security-headers";

const toMap = (isProduction: boolean) => new Map(securityHeaders(isProduction).map((h) => [h.key, h.value]));

describe("securityHeaders", () => {
  it("always sets the basic headers", () => {
    const headers = toMap(false);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toBe("microphone=(self), camera=(self)");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("adds HSTS in production", () => {
    expect(toMap(true).get("Strict-Transport-Security")).toMatch(/max-age=\d+/);
  });
});

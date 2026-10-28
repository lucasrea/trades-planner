import { describe, expect, it } from "vitest";
import { DescribeExtractionSchema } from "@/lib/ai/schemas";

describe("DescribeExtractionSchema", () => {
  it("accepts valid extraction", () => {
    const parsed = DescribeExtractionSchema.parse({
      intent: "quote",
      client_name: "Patel",
      job_title: "Heater",
      site_address: null,
      scope_notes: null,
      lines: [{ kind: "labour", description: "Install", quantity: 2, unit: "hr", unit_price: null }],
      warnings: [],
    });
    expect(parsed.lines).toHaveLength(1);
  });

  it("rejects malformed extraction", () => {
    expect(() =>
      DescribeExtractionSchema.parse({
        intent: "quote",
        lines: [{ kind: "labour", description: "", quantity: 0, unit: "hr", unit_price: null }],
        warnings: [],
      }),
    ).toThrow();
  });
});

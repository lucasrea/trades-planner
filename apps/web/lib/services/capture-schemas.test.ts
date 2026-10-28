import { describe, expect, it } from "vitest";
import { confirmCaptureSchema } from "@/lib/services/capture-schemas";

describe("confirmCaptureSchema", () => {
  it("rejects forged createAs values", () => {
    expect(() =>
      confirmCaptureSchema.parse({
        captureId: "cap_1",
        createAs: "foo",
        lines: [{ kind: "labour", description: "Work", quantity: 1, unit: "hr", unitPrice: 10 }],
      }),
    ).toThrow();
  });

  it("accepts valid confirm payload", () => {
    const parsed = confirmCaptureSchema.parse({
      captureId: "cap_1",
      createAs: "quote",
      client: { id: "client_1" },
      job: { id: "job_1" },
      lines: [{ kind: "labour", description: "Work", quantity: 1, unit: "hr", unitPrice: 10 }],
    });
    expect(parsed.createAs).toBe("quote");
  });
});

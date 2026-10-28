import { describe, expect, it } from "vitest";
import { defaultCreateAs } from "@/lib/captures-display";

describe("defaultCreateAs", () => {
  it("adds to the job already chosen unless the description asks to bill", () => {
    expect(defaultCreateAs({ captureType: "text", intent: "quote", jobId: "job-1" })).toBe("log");
    expect(defaultCreateAs({ captureType: "text", intent: null, jobId: "job-1" })).toBe("log");
    expect(defaultCreateAs({ captureType: "text", intent: "invoice", jobId: "job-1" })).toBe("invoice");
  });

  it("follows the description when no job is chosen", () => {
    expect(defaultCreateAs({ captureType: "text", intent: "quote", jobId: null })).toBe("quote");
    expect(defaultCreateAs({ captureType: "text", intent: null, jobId: null })).toBe("quote");
    expect(defaultCreateAs({ captureType: "text", intent: "log", jobId: null })).toBe("log");
    expect(defaultCreateAs({ captureType: "text", intent: "invoice", jobId: null })).toBe("invoice");
  });

  it("keeps receipts on the job", () => {
    expect(defaultCreateAs({ captureType: "receipt", intent: "quote", jobId: null })).toBe("log");
  });
});

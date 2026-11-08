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

  it("follows the Plan action when the proposal names one", () => {
    const base = { captureType: "text", intent: null, jobId: null } as const;
    expect(defaultCreateAs({ ...base, action: "add_materials" })).toBe("log");
    expect(defaultCreateAs({ ...base, action: "log_hours" })).toBe("log");
    expect(defaultCreateAs({ ...base, action: "make_quote" })).toBe("quote");
    expect(defaultCreateAs({ ...base, action: "make_invoice" })).toBe("invoice");
  });
});

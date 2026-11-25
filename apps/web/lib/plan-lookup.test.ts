import { describe, expect, it } from "vitest";
import { asksForAllJobs, formatAllJobsUnbilled, formatJobUnbilled, pickLookupJob, unbilledSummary } from "@/lib/plan-lookup";

const jobs = [
  { id: "bath", title: "Bathroom" },
  { id: "kitchen", title: "Kitchen reno" },
];

describe("pickLookupJob", () => {
  it("uses a partial name from the model instead of the open job", () => {
    expect(pickLookupJob(jobs, "kitchen", "bath", "add a valve to the kitchen")).toBe("kitchen");
  });

  it("does not substitute the open job when the named job is unknown", () => {
    expect(pickLookupJob(jobs, "garage", "bath", "the garage")).toBeNull();
  });

  it("uses the open job when the model did not name one", () => {
    expect(pickLookupJob(jobs, null, "bath", "what's unbilled")).toBe("bath");
  });

  it("returns null when the model asks for all jobs", () => {
    expect(pickLookupJob(jobs, "all jobs", "bath", "for all jobs")).toBeNull();
    expect(asksForAllJobs("for all jobs, what unbilled work do i have")).toBe(true);
    expect(asksForAllJobs("for anything")).toBe(true);
    expect(asksForAllJobs("kitchen")).toBe(false);
  });
});

describe("unbilledSummary", () => {
  it("prices unpriced hours at the labour rate", () => {
    const summary = unbilledSummary(
      [
        { id: "1", kind: "labour", description: "Labour", quantity: 2, unit: "hr", unitPrice: null },
        { id: "2", kind: "material", description: "Valve", quantity: 1, unit: "ea", unitPrice: 45 },
      ],
      85,
    );
    expect(summary.lines[0]?.unitPrice).toBe(85);
    expect(summary.total).toBe(215);
  });

  it("formats single-job and all-jobs unbilled summaries", () => {
    const summary = unbilledSummary(
      [{ id: "1", kind: "labour", description: "Labour", quantity: 2, unit: "hr", unitPrice: null }],
      85,
    );
    expect(formatJobUnbilled("Kitchen", summary)).toContain("Kitchen — $170.00 unbilled");
    expect(formatJobUnbilled("Kitchen", summary)).toContain("Labour (2 hr) — $170.00");
    expect(
      formatAllJobsUnbilled([
        { jobTitle: "kitchen", clientName: "pippo", lineCount: 2, total: 425 },
        { jobTitle: "Patel", clientName: "Patel", lineCount: 0, total: 0 },
        { jobTitle: "E2E probe", clientName: "Test Client", lineCount: 1, total: 164.2 },
      ]),
    ).toBe("Unbilled work — $589.20 total\n• kitchen (pippo): $425.00 (2 items)\n• E2E probe (Test Client): $164.20 (1 item)");
    expect(formatAllJobsUnbilled([])).toBe("You don't have any unbilled work right now.");
  });
});

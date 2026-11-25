import { describe, expect, it } from "vitest";
import { pickLookupJob, unbilledSummary } from "@/lib/plan-lookup";

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
});

import { describe, expect, it } from "vitest";
import { aggregateScores, scoreFixture, type DescribeFixture } from "@/lib/ai/eval-score";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";

const fixture: DescribeFixture = {
  id: "sample",
  synthetic: true,
  text: "Quote two hours and a valve",
  context: { labourRate: 85, clients: [], openJobs: [] },
  expected: {
    intent: "quote",
    expectWarning: false,
    lines: [
      { kind: "labour", descriptionIncludes: "labour", quantity: 2, unitPrice: null },
      { kind: "material", descriptionIncludes: "valve", quantity: 1, unitPrice: 45 },
    ],
  },
};

const extraction: DescribeExtraction = {
  intent: "quote",
  client_name: null,
  job_title: null,
  site_address: null,
  scope_notes: null,
  lines: [
    { kind: "labour", description: "Labour", quantity: 2, unit: "hr", unit_price: null },
    { kind: "material", description: "Valve", quantity: 1, unit: "ea", unit_price: 45 },
  ],
  warnings: [],
};

describe("eval score", () => {
  it("counts a full match", () => {
    const score = scoreFixture(fixture, extraction);
    expect(score.allLinesCorrect).toBe(true);
    expect(score.intentCorrect).toBe(true);
    expect(score.invented).toBe(0);
  });

  it("counts an invented line", () => {
    const score = scoreFixture(fixture, {
      ...extraction,
      lines: [...extraction.lines, { kind: "other", description: "Admin", quantity: 1, unit: "ea", unit_price: 9999 }],
    });
    expect(score.allLinesCorrect).toBe(false);
    expect(score.invented).toBe(1);
  });

  it("aggregates rates", () => {
    const totals = aggregateScores([
      { ...scoreFixture(fixture, extraction), expectWarning: false, inputTokens: 10, outputTokens: 20 },
    ]);
    expect(totals.intentAccuracy).toBe(1);
    expect(totals.priceAccuracy).toBe(1);
    expect(totals.inputTokens).toBe(10);
  });
});

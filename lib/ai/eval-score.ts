import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import type { DescribeContext } from "@/lib/ai/provider";

export type ExpectedLine = {
  kind: "labour" | "material" | "other";
  descriptionIncludes: string;
  quantity: number;
  unitPrice: number | null;
};

export type DescribeFixture = {
  id: string;
  synthetic: true;
  text: string;
  context: DescribeContext;
  expected: {
    intent: "quote" | "invoice" | "log" | null;
    expectWarning: boolean;
    lines: ExpectedLine[];
  };
};

export type FixtureScore = {
  intentCorrect: boolean;
  allLinesCorrect: boolean;
  pricedExpected: number;
  pricedCorrect: number;
  invented: number;
  returnedLines: number;
  warningOk: boolean;
};

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function pricesMatch(actual: number | null, expected: number | null) {
  if (expected == null) return actual == null;
  return actual != null && Math.abs(actual - expected) <= 0.02;
}

function lineMatches(actual: DescribeExtraction["lines"][number], expected: ExpectedLine) {
  if (actual.kind !== expected.kind) return false;
  if (Math.abs(actual.quantity - expected.quantity) > 0.01) return false;
  if (!pricesMatch(actual.unit_price, expected.unitPrice)) return false;
  return norm(actual.description).includes(norm(expected.descriptionIncludes));
}

export function scoreFixture(fixture: DescribeFixture, extraction: DescribeExtraction): FixtureScore {
  const used = new Set<number>();
  let pricedExpected = 0;
  let pricedCorrect = 0;
  for (const expected of fixture.expected.lines) {
    if (expected.unitPrice != null) pricedExpected += 1;
    const index = extraction.lines.findIndex((line, i) => !used.has(i) && lineMatches(line, expected));
    if (index < 0) continue;
    used.add(index);
    if (expected.unitPrice != null) pricedCorrect += 1;
  }
  const matched = used.size;
  return {
    intentCorrect: extraction.intent === fixture.expected.intent,
    allLinesCorrect: matched === fixture.expected.lines.length && extraction.lines.length === matched,
    pricedExpected,
    pricedCorrect,
    invented: extraction.lines.length - matched,
    returnedLines: extraction.lines.length,
    warningOk: fixture.expected.expectWarning ? extraction.warnings.length > 0 : true,
  };
}

export type EvalTotals = {
  cases: number;
  intentAccuracy: number;
  allLinesCorrect: number;
  priceAccuracy: number;
  falseInventionRate: number;
  warningWhenUncertain: number;
  inputTokens: number;
  outputTokens: number;
};

export function aggregateScores(
  rows: Array<FixtureScore & { expectWarning: boolean; inputTokens: number; outputTokens: number }>,
): EvalTotals {
  const cases = rows.length || 1;
  const priced = rows.reduce((sum, row) => sum + row.pricedExpected, 0);
  const returned = rows.reduce((sum, row) => sum + row.returnedLines, 0);
  const uncertain = rows.filter((row) => row.expectWarning);
  return {
    cases: rows.length,
    intentAccuracy: rows.filter((row) => row.intentCorrect).length / cases,
    allLinesCorrect: rows.filter((row) => row.allLinesCorrect).length / cases,
    priceAccuracy: priced === 0 ? 1 : rows.reduce((sum, row) => sum + row.pricedCorrect, 0) / priced,
    falseInventionRate: returned === 0 ? 0 : rows.reduce((sum, row) => sum + row.invented, 0) / returned,
    warningWhenUncertain: uncertain.length === 0 ? 1 : uncertain.filter((row) => row.warningOk).length / uncertain.length,
    inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
    outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
  };
}

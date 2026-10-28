#!/usr/bin/env npx tsx
/**
 * Paid describe eval. Not part of CI.
 * Usage: npx tsx scripts/eval-extraction.ts
 * Requires AI_PROVIDER=live, OPENAI_API_KEY, and EXTRACTION_MODEL.
 */
import fs from "node:fs";
import path from "node:path";
import { aggregateScores, scoreFixture, type DescribeFixture } from "../lib/ai/eval-score";

type Thresholds = {
  intentAccuracy: number;
  allLinesCorrect: number;
  priceAccuracy: number;
  maxFalseInventionRate: number;
  warningWhenUncertain: number;
};

function estimateUsd(model: string, inputTokens: number, outputTokens: number) {
  const rates: Record<string, [number, number]> = {
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4.1-mini": [0.4, 1.6],
    "gpt-4.1": [2, 8],
    "gpt-4o": [2.5, 10],
  };
  const key = Object.keys(rates).find((name) => model.startsWith(name));
  const [inputRate, outputRate] = key ? rates[key]! : [0.15, 0.6];
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}

async function main() {
  process.env.AI_PROVIDER = "live";
  const { runDescribeExtraction } = await import("../lib/ai/run-describe");
  const dir = path.join(process.cwd(), "lib/ai/fixtures/describe");
  const fixtures = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as DescribeFixture);
  const thresholds = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "lib/ai/eval-thresholds.json"), "utf8"),
  ) as Thresholds;

  const rows = [];
  let model = process.env.EXTRACTION_MODEL ?? "unknown";
  for (const fixture of fixtures) {
    const result = await runDescribeExtraction({ text: fixture.text, context: fixture.context });
    model = result.model;
    const score = scoreFixture(fixture, result.extraction);
    rows.push({
      ...score,
      expectWarning: fixture.expected.expectWarning,
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
      id: fixture.id,
    });
    console.log(
      `${fixture.id}: intent ${score.intentCorrect ? "ok" : "miss"} lines ${score.allLinesCorrect ? "ok" : "miss"} invented ${score.invented}`,
    );
  }

  const totals = aggregateScores(rows);
  const cost = estimateUsd(model, totals.inputTokens, totals.outputTokens);
  const report = { model, ...totals, estimatedUsd: Number(cost.toFixed(4)), thresholds };
  console.log(JSON.stringify(report, null, 2));

  const failed =
    totals.intentAccuracy < thresholds.intentAccuracy ||
    totals.allLinesCorrect < thresholds.allLinesCorrect ||
    totals.priceAccuracy < thresholds.priceAccuracy ||
    totals.falseInventionRate > thresholds.maxFalseInventionRate ||
    totals.warningWhenUncertain < thresholds.warningWhenUncertain;
  if (failed) {
    console.error("Eval below lib/ai/eval-thresholds.json");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

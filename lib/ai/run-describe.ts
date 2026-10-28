import { assertLiveProviderAllowed, createFakeExtractionProvider } from "@/lib/ai/fake";
import { extractDescribeLive, type DescribeRunResult } from "@/lib/ai/extract-describe";
import { DescribeExtractionSchema } from "@/lib/ai/schemas";
import { DESCRIBE_PROMPT_VERSION } from "@/lib/ai/prompts";
import type { DescribeContext } from "@/lib/ai/provider";

export async function runDescribeExtraction(input: { text: string; context: DescribeContext }): Promise<DescribeRunResult> {
  const providerMode = process.env.AI_PROVIDER ?? (process.env.NODE_ENV === "production" ? "live" : "fake");
  const started = Date.now();
  if (providerMode === "live") {
    assertLiveProviderAllowed();
    return extractDescribeLive(input);
  }
  const fake = createFakeExtractionProvider();
  const raw = await fake.extractDescribe(input);
  const extraction = DescribeExtractionSchema.parse(raw);
  return {
    extraction,
    model: "fake",
    latencyMs: Date.now() - started,
    inputTokens: null,
    outputTokens: null,
    promptVersion: DESCRIBE_PROMPT_VERSION,
  };
}

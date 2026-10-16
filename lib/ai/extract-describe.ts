import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { getOpenAIClient, readExtractionModel, readExtractionModelFallback } from "@/lib/ai/client";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { DESCRIBE_PROMPT_VERSION, describeSystemPrompt } from "@/lib/ai/prompts";
import { DescribeExtractionSchema } from "@/lib/ai/schemas";
import { ProviderError, type DescribeContext } from "@/lib/ai/provider";

const RESPONSE_NAME = "extract_describe";
/** Two attempts + jitter must stay under the text route maxDuration (60s). */
const TIMEOUT_MS = 25_000;

export type DescribeRunResult = {
  extraction: DescribeExtraction;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  promptVersion: string;
};

function jitterMs() {
  return 200 + Math.floor(Math.random() * 400);
}

function isRetryableStatus(status: number | undefined) {
  return status === 429 || (status != null && status >= 500);
}

function errorStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error) {
    const status = Number((error as { status: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
}

function buildUserMessage(text: string, context: DescribeContext) {
  const clientNames = context.clients.map((c) => c.name).join(", ") || "(none)";
  const jobs = context.openJobs.map((j) => `${j.title} (${j.clientName})`).join("; ") || "(none)";
  return [
    `Contractor labour rate (CAD/hr): ${context.labourRate}`,
    `Known clients: ${clientNames}`,
    `Open jobs: ${jobs}`,
    "",
    "Transcript or typed description:",
    text,
  ].join("\n");
}

export async function callOpenAIDescribe(
  client: OpenAI,
  input: { text: string; context: DescribeContext; model: string; signal: AbortSignal },
): Promise<{ extraction: DescribeExtraction; inputTokens: number | null; outputTokens: number | null }> {
  const response = await client.chat.completions.parse(
    {
      model: input.model,
      messages: [
        { role: "system", content: describeSystemPrompt },
        { role: "user", content: buildUserMessage(input.text, input.context) },
      ],
      response_format: zodResponseFormat(DescribeExtractionSchema, RESPONSE_NAME),
    },
    { signal: input.signal },
  );

  const parsed = response.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new ProviderError("Model did not return structured extraction.");
  }
  const extraction = DescribeExtractionSchema.parse(parsed);
  return {
    extraction,
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  };
}

export async function extractDescribeLive(input: {
  text: string;
  context: DescribeContext;
  client?: OpenAI;
}): Promise<DescribeRunResult> {
  const openai = input.client ?? getOpenAIClient();
  const primary = readExtractionModel();
  const fallback = readExtractionModelFallback();
  const started = Date.now();

  async function attempt(model: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await callOpenAIDescribe(openai, {
        text: input.text,
        context: input.context,
        model,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    const result = await attempt(primary);
    return {
      extraction: result.extraction,
      model: primary,
      latencyMs: Date.now() - started,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      promptVersion: DESCRIBE_PROMPT_VERSION,
    };
  } catch (first) {
    if (!isRetryableStatus(errorStatus(first))) throw first;
    await new Promise((resolve) => setTimeout(resolve, jitterMs()));
    const retryModel = fallback ?? primary;
    const result = await attempt(retryModel);
    return {
      extraction: result.extraction,
      model: retryModel,
      latencyMs: Date.now() - started,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      promptVersion: DESCRIBE_PROMPT_VERSION,
    };
  }
}

export function createLiveExtractionProvider() {
  return {
    async extractDescribe(params: { text: string; context: DescribeContext }) {
      const result = await extractDescribeLive(params);
      return result.extraction;
    },
    async extractReceipt() {
      throw new ProviderError("Live receipt extraction is not implemented yet.");
    },
  };
}

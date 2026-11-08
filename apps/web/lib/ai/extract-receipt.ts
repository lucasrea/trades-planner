import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAIClient, readExtractionModel, readExtractionModelFallback } from "@/lib/ai/client";
import { assertLiveProviderAllowed, createFakeExtractionProvider } from "@/lib/ai/fake";
import type { ReceiptExtraction } from "@/lib/ai/extraction-types";
import { RECEIPT_PROMPT_VERSION, receiptSystemPrompt } from "@/lib/ai/prompts";
import { ProviderError } from "@/lib/ai/provider";
import { ReceiptExtractionSchema } from "@/lib/ai/schemas";

const RESPONSE_NAME = "extract_receipt";
const TIMEOUT_MS = 25_000;

/** Strict structured outputs need every field required, so currency has no default here. */
const ReceiptLiveSchema = ReceiptExtractionSchema.extend({ currency: z.string() });

export type ReceiptRunResult = {
  extraction: ReceiptExtraction;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  promptVersion: string;
};

function errorStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error) {
    const status = Number((error as { status: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
}

function isRetryableStatus(status: number | undefined) {
  return status === 429 || (status != null && status >= 500);
}

async function callOpenAIReceipt(
  client: OpenAI,
  input: { imageBytes: Uint8Array; mimeType: string; model: string; signal: AbortSignal },
) {
  const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.imageBytes).toString("base64")}`;
  const response = await client.chat.completions.parse(
    {
      model: input.model,
      messages: [
        { role: "system", content: receiptSystemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Read this receipt." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: zodResponseFormat(ReceiptLiveSchema, RESPONSE_NAME),
    },
    { signal: input.signal },
  );
  const parsed = response.choices[0]?.message?.parsed;
  if (!parsed) throw new ProviderError("Model did not return a structured receipt.");
  return {
    extraction: ReceiptExtractionSchema.parse(parsed),
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  };
}

export async function extractReceiptLive(input: {
  imageBytes: Uint8Array;
  mimeType: string;
  client?: OpenAI;
}): Promise<ReceiptRunResult> {
  const openai = input.client ?? getOpenAIClient();
  const primary = readExtractionModel();
  const fallback = readExtractionModelFallback();
  const started = Date.now();

  async function attempt(model: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await callOpenAIReceipt(openai, { ...input, model, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  let model = primary;
  let result;
  try {
    result = await attempt(primary);
  } catch (first) {
    if (!isRetryableStatus(errorStatus(first))) throw first;
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 400)));
    model = fallback ?? primary;
    result = await attempt(model);
  }
  return {
    extraction: result.extraction,
    model,
    latencyMs: Date.now() - started,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    promptVersion: RECEIPT_PROMPT_VERSION,
  };
}

/** Live vision when AI_PROVIDER=live (default in production); the fake provider otherwise. */
export async function runReceiptExtraction(input: { imageBytes: Uint8Array; mimeType: string }): Promise<ReceiptRunResult> {
  const providerMode = process.env.AI_PROVIDER ?? (process.env.NODE_ENV === "production" ? "live" : "fake");
  const started = Date.now();
  if (providerMode === "live") {
    assertLiveProviderAllowed();
    return extractReceiptLive(input);
  }
  const raw = await createFakeExtractionProvider().extractReceipt(input);
  return {
    extraction: ReceiptExtractionSchema.parse(raw),
    model: "fake",
    latencyMs: Date.now() - started,
    inputTokens: null,
    outputTokens: null,
    promptVersion: RECEIPT_PROMPT_VERSION,
  };
}

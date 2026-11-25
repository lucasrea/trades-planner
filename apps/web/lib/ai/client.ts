import OpenAI from "openai";
import { ProviderError } from "@/lib/ai/provider";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ProviderError("OPENAI_API_KEY is required for live extraction.");
  return new OpenAI({ apiKey, maxRetries: 0 });
}

export function readExtractionModel() {
  const model = process.env.EXTRACTION_MODEL?.trim();
  if (!model) throw new ProviderError("EXTRACTION_MODEL is required for live extraction.");
  return model;
}

export function readExtractionModelFallback() {
  return process.env.EXTRACTION_MODEL_FALLBACK?.trim() || null;
}

/**
 * Lower reasoning effort on GPT-5 models to avoid slow/expensive thinking tokens.
 * GPT-5 / gpt-5-mini / gpt-5-nano accept "minimal" (they reject "none" with HTTP 400).
 * GPT-5.1+ non-pro/non-codex models accept "none". Older models reject the field.
 */
export function modelRequestOptions(model: string): { reasoning_effort?: "none" | "minimal" } {
  if (/^gpt-5(?:-(?:mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) {
    return { reasoning_effort: "minimal" };
  }
  if (/^gpt-(?:5\.[1-9]|[6-9])/.test(model) && !/(?:pro|codex)/i.test(model)) {
    return { reasoning_effort: "none" };
  }
  return {};
}

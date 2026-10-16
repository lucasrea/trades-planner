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

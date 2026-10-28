import type OpenAI from "openai";
import { toFile } from "openai";
import { audioFilename } from "@/lib/captures/audio";
import { getOpenAIClient } from "@/lib/ai/client";
import { ProviderError } from "@/lib/ai/provider";

const TIMEOUT_MS = 30_000;

function jitterMs() {
  return 200 + Math.floor(Math.random() * 400);
}

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

export function readTranscriptionModel() {
  const model = process.env.TRANSCRIPTION_MODEL?.trim();
  if (!model) throw new ProviderError("TRANSCRIPTION_MODEL is required for live transcription.");
  return model;
}

export async function transcribeLive(input: {
  audioBytes: Uint8Array;
  mimeType: string;
  client?: OpenAI;
}): Promise<string> {
  const openai = input.client ?? getOpenAIClient();
  const model = readTranscriptionModel();

  async function attempt() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const file = await toFile(input.audioBytes, audioFilename(input.mimeType), { type: input.mimeType });
      const result = await openai.audio.transcriptions.create({ file, model }, { signal: controller.signal });
      return typeof result === "string" ? result : result.text;
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    return await attempt();
  } catch (first) {
    if (!isRetryableStatus(errorStatus(first))) throw first;
    await new Promise((resolve) => setTimeout(resolve, jitterMs()));
    return attempt();
  }
}

export function createLiveTranscriptionProvider() {
  return {
    async transcribe(input: { audioBytes: Uint8Array; mimeType: string }) {
      return transcribeLive(input);
    },
  };
}

import { afterEach, describe, expect, it } from "vitest";
import { createFakeExtractionProvider, createFakeTranscriptionProvider, readFakeMode } from "@/lib/ai/fake";
import { ProviderError } from "@/lib/ai/provider";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe("AI fake provider", () => {
  it("returns describe extraction in ok mode", async () => {
    process.env.AI_FAKE_MODE = "ok";
    const provider = createFakeExtractionProvider();
    const result = await provider.extractDescribe({
      text: "Quote for tank swap",
      context: { labourRate: 85, openJobs: [], clients: [] },
    });
    expect(result.lines.length).toBeGreaterThan(0);
    expect(readFakeMode()).toBe("ok");
  });

  it("throws in error mode", async () => {
    process.env.AI_FAKE_MODE = "error";
    const provider = createFakeExtractionProvider();
    await expect(
      provider.extractDescribe({ text: "x", context: { labourRate: 1, openJobs: [], clients: [] } }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("returns empty lines in empty mode", async () => {
    process.env.AI_FAKE_MODE = "empty";
    const provider = createFakeExtractionProvider();
    const result = await provider.extractReceipt({ imageBytes: new Uint8Array([1, 2]), mimeType: "image/jpeg" });
    expect(result.lines).toEqual([]);
  });

  it("transcribes audio in ok mode", async () => {
    process.env.AI_FAKE_MODE = "ok";
    const provider = createFakeTranscriptionProvider();
    const text = await provider.transcribe({ audioBytes: new Uint8Array(10), mimeType: "audio/webm" });
    expect(text.length).toBeGreaterThan(0);
  });
});

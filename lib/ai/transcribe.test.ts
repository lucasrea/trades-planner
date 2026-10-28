import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeLive } from "@/lib/ai/transcribe";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("transcribeLive", () => {
  it("returns transcript text", async () => {
    process.env.TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
    const client = {
      audio: { transcriptions: { create: vi.fn(async () => ({ text: "Quote for Patel" })) } },
    };
    const text = await transcribeLive({
      audioBytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/webm",
      client: client as never,
    });
    expect(text).toBe("Quote for Patel");
    expect(client.audio.transcriptions.create).toHaveBeenCalledTimes(1);
  });

  it("does not retry a validation-style 400", async () => {
    process.env.TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
    const client = {
      audio: { transcriptions: { create: vi.fn(async () => { throw Object.assign(new Error("bad"), { status: 400 }); }) } },
    };
    await expect(
      transcribeLive({ audioBytes: new Uint8Array([1]), mimeType: "audio/wav", client: client as never }),
    ).rejects.toThrow(/bad/);
    expect(client.audio.transcriptions.create).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from "vitest";
import { validateAudioFile } from "@/lib/captures/audio";

describe("validateAudioFile", () => {
  it("accepts a small webm file", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "note.webm", { type: "audio/webm;codecs=opus" });
    const result = await validateAudioFile(file);
    expect(result.ok).toBe(true);
  });

  it("rejects the wrong type", async () => {
    const file = new File([new Uint8Array([1])], "note.txt", { type: "text/plain" });
    const result = await validateAudioFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects audio over 4 MB", async () => {
    const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.wav", { type: "audio/wav" });
    const result = await validateAudioFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });
});

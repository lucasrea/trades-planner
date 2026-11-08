import type OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractReceiptLive, runReceiptExtraction } from "@/lib/ai/extract-receipt";
import { RECEIPT_PROMPT_VERSION } from "@/lib/ai/prompts";
import { ProviderError } from "@/lib/ai/provider";

const env = process.env;
afterEach(() => {
  process.env = { ...env };
});

const IMAGE = { imageBytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2]), mimeType: "image/jpeg" };

describe("runReceiptExtraction (fake provider)", () => {
  it("reads two lines without any network call", async () => {
    process.env.AI_PROVIDER = "fake";
    process.env.AI_FAKE_MODE = "ok";
    const result = await runReceiptExtraction(IMAGE);
    expect(result.model).toBe("fake");
    expect(result.promptVersion).toBe(RECEIPT_PROMPT_VERSION);
    expect(result.extraction.lines).toHaveLength(2);
    expect(result.extraction.vendor).toBeTruthy();
  });

  it("surfaces provider errors", async () => {
    process.env.AI_PROVIDER = "fake";
    process.env.AI_FAKE_MODE = "error";
    await expect(runReceiptExtraction(IMAGE)).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("extractReceiptLive (stub client, no network)", () => {
  function stubClient(parsed: unknown) {
    const parse = vi.fn().mockResolvedValue({
      choices: [{ message: { parsed } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    return { client: { chat: { completions: { parse } } } as unknown as OpenAI, parse };
  }

  it("sends the photo as an image_url and validates the answer", async () => {
    process.env.EXTRACTION_MODEL = "test-model";
    const { client, parse } = stubClient({
      vendor: "Lumber Yard",
      purchased_at: "2026-11-01",
      currency: "CAD",
      subtotal: 10,
      tax: 1.3,
      total: 11.3,
      lines: [{ description: "Screws", quantity: 2, unit_price: 5, line_total: 10 }],
      warnings: [],
    });
    const result = await extractReceiptLive({ ...IMAGE, client });
    expect(result.extraction.lines[0]?.description).toBe("Screws");
    expect(result.inputTokens).toBe(11);
    const call = parse.mock.calls[0]![0];
    const userContent = call.messages[1].content as { type: string; image_url?: { url: string } }[];
    expect(userContent.some((part) => part.type === "image_url" && part.image_url?.url.startsWith("data:image/jpeg;base64,"))).toBe(true);
  });

  it("rejects an answer that fails the schema", async () => {
    process.env.EXTRACTION_MODEL = "test-model";
    const { client } = stubClient({ vendor: null, lines: [{ description: "x", quantity: 0, unit_price: 1, line_total: 1 }] });
    await expect(extractReceiptLive({ ...IMAGE, client })).rejects.toThrow();
  });
});

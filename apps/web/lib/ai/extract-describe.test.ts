import { afterEach, describe, expect, it, vi } from "vitest";
import { modelRequestOptions } from "@/lib/ai/client";
import { callOpenAIDescribe, extractDescribeLive } from "@/lib/ai/extract-describe";
import { ProviderError } from "@/lib/ai/provider";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("modelRequestOptions", () => {
  it("uses minimal reasoning for gpt-5/mini/nano, none for gpt-5.1+, and omits for older/pro models", () => {
    expect(modelRequestOptions("gpt-5-mini")).toEqual({ reasoning_effort: "minimal" });
    expect(modelRequestOptions("gpt-5")).toEqual({ reasoning_effort: "minimal" });
    expect(modelRequestOptions("gpt-5-nano")).toEqual({ reasoning_effort: "minimal" });
    expect(modelRequestOptions("gpt-5.1")).toEqual({ reasoning_effort: "none" });
    expect(modelRequestOptions("gpt-5.2")).toEqual({ reasoning_effort: "none" });
    expect(modelRequestOptions("gpt-5-pro")).toEqual({});
    expect(modelRequestOptions("gpt-4o-mini")).toEqual({});
  });
});

describe("extractDescribeLive", () => {
  it("parses structured output and records token usage", async () => {
    const client = {
      chat: {
        completions: {
          parse: vi.fn(async () => ({
            usage: { prompt_tokens: 10, completion_tokens: 20 },
            choices: [
              {
                message: {
                  parsed: {
                    intent: "quote",
                    client_name: "Patel",
                    job_title: null,
                    site_address: null,
                    scope_notes: null,
                    lines: [{ kind: "labour", description: "Work", quantity: 1, unit: "hr", unit_price: null }],
                    warnings: [],
                  },
                },
              },
            ],
          })),
        },
      },
    };

    const result = await callOpenAIDescribe(client as never, {
      text: "Quote Patel one hour labour",
      context: { labourRate: 85, clients: [], openJobs: [] },
      model: "gpt-4o-mini",
      signal: AbortSignal.timeout(1000),
    });
    expect(result.extraction.lines).toHaveLength(1);
    expect(result.inputTokens).toBe(10);
  });

  it("does not retry validation failures", async () => {
    process.env.EXTRACTION_MODEL = "gpt-4o-mini";
    const client = {
      chat: {
        completions: {
          parse: vi.fn(async () => ({
            usage: {},
            choices: [
              {
                message: {
                  parsed: {
                    intent: "quote",
                    client_name: null,
                    job_title: null,
                    site_address: null,
                    scope_notes: null,
                    lines: [{ kind: "labour", description: "x", quantity: 0, unit: "hr", unit_price: null }],
                    warnings: [],
                  },
                },
              },
            ],
          })),
        },
      },
    };
    await expect(
      extractDescribeLive({
        text: "bad",
        context: { labourRate: 85, clients: [], openJobs: [] },
        client: client as never,
      }),
    ).rejects.toBeTruthy();
    expect(client.chat.completions.parse).toHaveBeenCalledTimes(1);
  });

  it("throws when structured output missing", async () => {
    const client = {
      chat: {
        completions: {
          parse: vi.fn(async () => ({
            usage: {},
            choices: [{ message: { parsed: null } }],
          })),
        },
      },
    };
    await expect(
      callOpenAIDescribe(client as never, {
        text: "x",
        context: { labourRate: 1, clients: [], openJobs: [] },
        model: "gpt-4o-mini",
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

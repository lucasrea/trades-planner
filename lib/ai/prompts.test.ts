import { describe, expect, it } from "vitest";
import { DESCRIBE_PROMPT_VERSION, describeSystemPrompt } from "@/lib/ai/prompts";

describe("describe prompts", () => {
  it("has stable version and prompt snapshot", () => {
    expect(DESCRIBE_PROMPT_VERSION).toMatch(/^describe-v\d+$/);
    expect(describeSystemPrompt).toMatchSnapshot();
  });
});

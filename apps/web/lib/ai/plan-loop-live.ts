import OpenAI from "openai";
import { getOpenAIClient, modelRequestOptions, readExtractionModel } from "@/lib/ai/client";
import type { PlanLoopClient, PlanLoopMessage } from "@/lib/ai/plan-loop";
import { PLAN_TOOLS } from "@/lib/ai/plan-tools";

function toApi(messages: PlanLoopMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return { role: "tool", tool_call_id: message.toolCallId ?? "", content: message.content ?? "" };
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {
        role: "assistant",
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: message.role === "system" || message.role === "assistant" ? message.role : "user", content: message.content ?? "" };
  });
}

export function createLivePlanClient(): PlanLoopClient & { model: string } {
  const client = getOpenAIClient();
  // Plan can run on its own model; receipts and the describe eval keep EXTRACTION_MODEL.
  const model = process.env.PLAN_MODEL?.trim() || readExtractionModel();
  return {
    model,
    async complete(messages, signal, options) {
      const tools = options?.tools ? PLAN_TOOLS.filter((entry) => options.tools!.includes(entry.function.name)) : PLAN_TOOLS;
      const response = await client.chat.completions.create(
        {
          model,
          messages: toApi(messages),
          tools,
          ...(options?.tools ? { tool_choice: "required" as const } : {}),
          ...modelRequestOptions(model),
          ...planModelOverrides(),
        },
        { signal },
      );
      const message = response.choices[0]?.message;
      const toolCalls = (message?.tool_calls ?? []).flatMap((call) => {
        if (call.type !== "function") return [];
        return [{ id: call.id, name: call.function.name, arguments: call.function.arguments }];
      });
      return { content: message?.content ?? null, toolCalls };
    },
  };
}

/**
 * Optional tuning for the Plan loop only, so a setting can be tried with the conversation eval (and then in
 * production) without a code change. GPT-5 models ignore temperature; these are the settings that apply.
 */
function planModelOverrides(): { reasoning_effort?: "minimal" | "low" | "medium"; verbosity?: "low" | "medium" | "high" } {
  const effort = process.env.PLAN_REASONING_EFFORT?.trim();
  const verbosity = process.env.PLAN_VERBOSITY?.trim();
  return {
    ...(effort === "minimal" || effort === "low" || effort === "medium" ? { reasoning_effort: effort } : {}),
    ...(verbosity === "low" || verbosity === "medium" || verbosity === "high" ? { verbosity } : {}),
  };
}

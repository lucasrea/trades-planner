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
  const model = readExtractionModel();
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

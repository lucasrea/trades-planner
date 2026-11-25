import { PLAN_LOOP_PROMPT } from "@/lib/ai/prompts";
import { statusForTool } from "@/lib/ai/plan-tools";

export const PLAN_LOOP_MAX_STEPS = 4;

export type PlanToolCall = { id: string; name: string; arguments: string };

export type PlanLoopMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: PlanToolCall[];
  toolCallId?: string;
};

export type PlanLoopStep = {
  content: string | null;
  toolCalls: PlanToolCall[];
};

/** The model client. Tests pass a script. Live code calls the OpenAI SDK. */
export type PlanLoopClient = {
  complete(messages: PlanLoopMessage[], signal: AbortSignal): Promise<PlanLoopStep>;
};

const STEP_TIMEOUT_MS = 20_000;

export type PlanHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Run tool calls until the model stops or the step cap is hit.
 * The sequence is whatever the model asks for. This only carries the results back.
 */
export async function runPlanLoop(input: {
  client: PlanLoopClient;
  contextNote: string;
  userText: string;
  history?: PlanHistoryMessage[];
  execute: (call: PlanToolCall) => Promise<string>;
  onStatus?: (text: string) => void;
  maxSteps?: number;
}): Promise<void> {
  const prior: PlanLoopMessage[] = (input.history ?? [])
    .filter((entry) => entry.content.trim().length > 0)
    .map((entry) => ({ role: entry.role, content: entry.content }));
  const messages: PlanLoopMessage[] = [
    { role: "system", content: PLAN_LOOP_PROMPT },
    ...prior,
    { role: "user", content: `${input.contextNote}\n\nMessage:\n${input.userText}` },
  ];
  const maxSteps = input.maxSteps ?? PLAN_LOOP_MAX_STEPS;

  for (let step = 0; step < maxSteps; step += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
    let next: PlanLoopStep;
    try {
      next = await input.client.complete(messages, controller.signal);
    } finally {
      clearTimeout(timer);
    }
    if (next.toolCalls.length === 0) {
      const text = next.content?.trim();
      if (text) input.onStatus?.("Writing a reply");
      if (text) await input.execute({ id: `reply-${step}`, name: "reply", arguments: JSON.stringify({ text }) });
      return;
    }
    messages.push({ role: "assistant", content: next.content, toolCalls: next.toolCalls });
    const calls = next.toolCalls.slice(0, 4);
    for (const call of calls) {
      input.onStatus?.(statusForTool(call.name, call.arguments));
      let result: string;
      try {
        result = await input.execute(call);
      } catch {
        result = JSON.stringify({ error: "That step failed." });
      }
      messages.push({ role: "tool", content: result, toolCallId: call.id });
    }
    for (const call of next.toolCalls.slice(4)) {
      messages.push({ role: "tool", content: JSON.stringify({ error: "Skipped. Send the rest next." }), toolCallId: call.id });
    }
  }
}

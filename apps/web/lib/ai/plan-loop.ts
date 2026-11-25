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
/**
 * The whole loop must finish well inside the route's 60 s limit, or the platform kills the request
 * mid-stream and the contractor sees nothing. Four 20 s steps would not fit.
 */
export const PLAN_LOOP_BUDGET_MS = 40_000;
/** Do not start a retry with less than this left. */
const MIN_RETRY_MS = 3_000;

export class PlanLoopTimeoutError extends Error {
  constructor() {
    super("Plan loop timeout.");
    this.name = "PlanLoopTimeoutError";
  }
}

/** Rate limits, provider outages, dropped connections and slow steps are worth one more try. */
function isRetryable(error: unknown, timedOut: boolean) {
  if (timedOut) return true;
  if (typeof error !== "object" || error === null) return false;
  const status = "status" in error ? Number((error as { status: unknown }).status) : NaN;
  if (status === 429 || status >= 500) return true;
  const name = "name" in error ? String((error as { name: unknown }).name) : "";
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError";
}

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
  budgetMs?: number;
  stepTimeoutMs?: number;
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
  const stopAt = Date.now() + (input.budgetMs ?? PLAN_LOOP_BUDGET_MS);
  const stepTimeout = input.stepTimeoutMs ?? STEP_TIMEOUT_MS;

  async function attempt(): Promise<PlanLoopStep> {
    const remaining = stopAt - Date.now();
    if (remaining <= 0) throw new PlanLoopTimeoutError();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.min(stepTimeout, remaining));
    try {
      return await input.client.complete(messages, controller.signal);
    } catch (error) {
      const failure = timedOut ? new PlanLoopTimeoutError() : error instanceof Error ? error : new Error(String(error));
      (failure as { retryable?: boolean }).retryable = isRetryable(error, timedOut);
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }

  async function completeStep(): Promise<PlanLoopStep> {
    try {
      return await attempt();
    } catch (first) {
      const retryable = typeof first === "object" && first !== null && (first as { retryable?: boolean }).retryable;
      if (!retryable || stopAt - Date.now() < MIN_RETRY_MS) throw first;
      await new Promise((resolve) => setTimeout(resolve, 250 + Math.floor(Math.random() * 250)));
      return attempt();
    }
  }

  for (let step = 0; step < maxSteps; step += 1) {
    const next = await completeStep();
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

import { PLAN_LOOP_PROMPT } from "@/lib/ai/prompts";
import { statusForTool } from "@/lib/ai/plan-tools";

export const PLAN_LOOP_MAX_STEPS = 6;

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

/** `tools` limits the step to those tools and requires the model to call one. */
export type PlanStepOptions = { tools?: string[] };

/** The model client. Tests pass a script. Live code calls the OpenAI SDK. */
export type PlanLoopClient = {
  complete(messages: PlanLoopMessage[], signal: AbortSignal, options?: PlanStepOptions): Promise<PlanLoopStep>;
};

/** The last step when a turn would otherwise end with nothing for the contractor. */
export const FINAL_STEP_TOOLS = ["reply", "ask"];
const FINAL_STEP_NUDGE =
  "You have not answered the contractor yet. Answer now from the tool results above with reply, or ask one question with choices with ask. Do not call any other tool.";

const STEP_TIMEOUT_MS = 20_000;
/**
 * The whole loop must finish well inside the route's 60 s limit, or the platform kills the request
 * mid-stream and the contractor sees nothing. Four 20 s steps would not fit.
 */
export const PLAN_LOOP_BUDGET_MS = 40_000;
/** Tool calls run per step. More are answered "send the rest next". */
const MAX_CALLS_PER_STEP = 6;
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
  /** True once the turn has a card, a reply or a question. Without it the loop takes one final step. */
  hasOutput?: () => boolean;
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

  async function attempt(options?: PlanStepOptions): Promise<PlanLoopStep> {
    const remaining = stopAt - Date.now();
    if (remaining <= 0) throw new PlanLoopTimeoutError();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.min(stepTimeout, remaining));
    try {
      return await input.client.complete(messages, controller.signal, options);
    } catch (error) {
      const failure = timedOut ? new PlanLoopTimeoutError() : error instanceof Error ? error : new Error(String(error));
      (failure as { retryable?: boolean }).retryable = isRetryable(error, timedOut);
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }

  async function completeStep(options?: PlanStepOptions): Promise<PlanLoopStep> {
    try {
      return await attempt(options);
    } catch (first) {
      const retryable = typeof first === "object" && first !== null && (first as { retryable?: boolean }).retryable;
      if (!retryable || stopAt - Date.now() < MIN_RETRY_MS) throw first;
      await new Promise((resolve) => setTimeout(resolve, 250 + Math.floor(Math.random() * 250)));
      return attempt(options);
    }
  }

  async function runCalls(step: PlanLoopStep, allowed?: string[]) {
    messages.push({ role: "assistant", content: step.content, toolCalls: step.toolCalls });
    const calls = step.toolCalls.slice(0, MAX_CALLS_PER_STEP);
    for (const call of calls) {
      if (allowed && !allowed.includes(call.name)) {
        messages.push({ role: "tool", content: JSON.stringify({ error: "Only reply or ask now." }), toolCallId: call.id });
        continue;
      }
      input.onStatus?.(statusForTool(call.name, call.arguments));
      let result: string;
      try {
        result = await input.execute(call);
      } catch {
        result = JSON.stringify({ error: "That step failed." });
      }
      messages.push({ role: "tool", content: result, toolCallId: call.id });
    }
    for (const call of step.toolCalls.slice(MAX_CALLS_PER_STEP)) {
      messages.push({ role: "tool", content: JSON.stringify({ error: "Skipped. Send the rest next." }), toolCallId: call.id });
    }
  }

  async function replyWith(text: string | null | undefined, step: number) {
    const trimmed = text?.trim();
    if (!trimmed) return;
    input.onStatus?.("Writing a reply");
    await input.execute({ id: `reply-${step}`, name: "reply", arguments: JSON.stringify({ text: trimmed }) });
  }

  let step = 0;
  for (; step < maxSteps; step += 1) {
    const next = await completeStep();
    if (next.toolCalls.length === 0) {
      await replyWith(next.content, step);
      break;
    }
    await runCalls(next);
  }

  // The model stopped, or ran out of steps, without a card, an answer or a question. One more step
  // that may only answer or ask, so the contractor never gets an empty turn.
  if (input.hasOutput && !input.hasOutput() && stopAt - Date.now() >= MIN_RETRY_MS) {
    messages.push({ role: "user", content: FINAL_STEP_NUDGE });
    const last = await completeStep({ tools: FINAL_STEP_TOOLS });
    if (last.toolCalls.length === 0) await replyWith(last.content, step + 1);
    else await runCalls(last, FINAL_STEP_TOOLS);
  }
}

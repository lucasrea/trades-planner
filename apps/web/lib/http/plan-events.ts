export type PlanDoneEvent = {
  type: "done";
  planId: string | null;
  captureId: string;
  reviewUrl: string;
  status: "needs_review" | "failed";
  reply: string | null;
};

export type PlanStreamEvent = { type: "status"; text: string } | PlanDoneEvent | { type: "error"; status: number; message: string };

export function parsePlanStreamLine(line: string): PlanStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || !("type" in value)) return null;
  const event = value as { type?: string; text?: string; message?: string; status?: number };
  if (event.type === "status" && typeof event.text === "string") return { type: "status", text: event.text };
  if (event.type === "error" && typeof event.message === "string") {
    return { type: "error", status: typeof event.status === "number" ? event.status : 500, message: event.message };
  }
  if (event.type === "done") return value as PlanDoneEvent;
  return null;
}

export function encodePlanEvent(event: PlanStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

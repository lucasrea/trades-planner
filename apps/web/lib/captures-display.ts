import type { PlanAction } from "@/lib/ai/extraction-types";

const STALE_PROCESSING_MS = 70_000;

export type CaptureCreateAs = "quote" | "invoice" | "log";

export function captureProcessingIsStale(createdAtMs: number, currentMs: number) {
  return currentMs - createdAtMs > STALE_PROCESSING_MS;
}

export function defaultCreateAs(input: {
  captureType: string;
  intent: CaptureCreateAs | null | undefined;
  jobId: string | null;
  action?: PlanAction | null;
}): CaptureCreateAs {
  if (input.captureType === "receipt") return "log";
  if (input.action === "add_materials" || input.action === "log_hours") return "log";
  if (input.action === "make_quote") return "quote";
  if (input.action === "make_invoice") return "invoice";
  if (input.intent === "invoice") return "invoice";
  if (input.jobId) return "log";
  if (input.intent === "log") return "log";
  return "quote";
}

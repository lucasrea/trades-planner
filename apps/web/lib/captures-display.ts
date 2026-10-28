const STALE_PROCESSING_MS = 70_000;

export type CaptureCreateAs = "quote" | "invoice" | "log";

export function captureProcessingIsStale(createdAtMs: number, currentMs: number) {
  return currentMs - createdAtMs > STALE_PROCESSING_MS;
}

export function defaultCreateAs(input: {
  captureType: string;
  intent: CaptureCreateAs | null | undefined;
  jobId: string | null;
}): CaptureCreateAs {
  if (input.captureType === "receipt") return "log";
  if (input.intent === "invoice") return "invoice";
  if (input.jobId) return "log";
  if (input.intent === "log") return "log";
  return "quote";
}

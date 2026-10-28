const STALE_PROCESSING_MS = 70_000;

export function captureProcessingIsStale(createdAtMs: number, currentMs: number) {
  return currentMs - createdAtMs > STALE_PROCESSING_MS;
}

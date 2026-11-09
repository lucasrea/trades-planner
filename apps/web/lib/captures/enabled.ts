import { jsonError } from "@/lib/http/json-error";

/** When AI_CAPTURE_ENABLED is exactly "false", capture API routes must not run. */
export function assertCaptureEnabled(): Response | null {
  if (process.env.AI_CAPTURE_ENABLED === "false") {
    return jsonError("unavailable", "Capture is turned off.", 503);
  }
  return null;
}

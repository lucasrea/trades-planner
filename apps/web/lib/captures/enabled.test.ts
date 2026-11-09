import { describe, expect, it } from "vitest";
import { assertCaptureEnabled } from "@/lib/captures/enabled";

describe("assertCaptureEnabled", () => {
  it('returns 503 only when AI_CAPTURE_ENABLED is exactly "false"', async () => {
    process.env.AI_CAPTURE_ENABLED = "false";
    const off = assertCaptureEnabled();
    expect(off?.status).toBe(503);
    expect(await off!.json()).toEqual({
      error: { code: "unavailable", message: "Capture is turned off." },
    });

    delete process.env.AI_CAPTURE_ENABLED;
    expect(assertCaptureEnabled()).toBeNull();

    process.env.AI_CAPTURE_ENABLED = "true";
    expect(assertCaptureEnabled()).toBeNull();
    delete process.env.AI_CAPTURE_ENABLED;
  });
});

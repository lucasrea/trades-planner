import { describe, expect, it } from "vitest";
import {
  MAX_RECORDING_MS,
  MAX_UPLOAD_BYTES,
  checkRecording,
  clampElapsedMs,
  formatElapsed,
  hasHitRecordingCap,
  pickRecorderMime,
  uploadFilename,
  uploadMime,
} from "@/lib/captures/recorder";
import { baseAudioMime } from "@/lib/captures/audio";

describe("pickRecorderMime", () => {
  it("prefers webm/opus when supported", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
  });

  it("falls back to mp4 on iOS Safari", () => {
    expect(pickRecorderMime((mime) => mime === "audio/mp4")).toBe("audio/mp4");
  });

  it("returns undefined when nothing is supported or there is no MediaRecorder", () => {
    expect(pickRecorderMime(() => false)).toBeUndefined();
    expect(pickRecorderMime(undefined)).toBeUndefined();
  });

  it("only picks types the voice route accepts", () => {
    const accepted = new Set(["audio/webm", "audio/ogg", "audio/mp4"]);
    for (const supported of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
      const picked = pickRecorderMime((mime) => mime === supported);
      expect(accepted.has(baseAudioMime(picked ?? ""))).toBe(true);
    }
  });
});

describe("120 second cap", () => {
  it("is two minutes", () => {
    expect(MAX_RECORDING_MS).toBe(120_000);
  });

  it("flags the cap at and after 120s only", () => {
    expect(hasHitRecordingCap(119_999)).toBe(false);
    expect(hasHitRecordingCap(120_000)).toBe(true);
    expect(hasHitRecordingCap(130_000)).toBe(true);
  });

  it("clamps elapsed time to 0..120s", () => {
    expect(clampElapsedMs(-5)).toBe(0);
    expect(clampElapsedMs(61_000)).toBe(61_000);
    expect(clampElapsedMs(500_000)).toBe(120_000);
  });
});

describe("formatElapsed", () => {
  it("formats m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(999)).toBe("0:00");
    expect(formatElapsed(9_000)).toBe("0:09");
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(120_000)).toBe("2:00");
    expect(formatElapsed(999_999)).toBe("2:00");
  });
});

describe("upload helpers", () => {
  it("uses the blob type, else the recorder mime, else webm", () => {
    expect(uploadMime("audio/mp4", "audio/webm")).toBe("audio/mp4");
    expect(uploadMime("", "audio/mp4")).toBe("audio/mp4");
    expect(uploadMime("", undefined)).toBe("audio/webm");
  });

  it("names files with an extension the route accepts", () => {
    expect(uploadFilename("audio/webm;codecs=opus")).toBe("capture.webm");
    expect(uploadFilename("audio/mp4")).toBe("capture.m4a");
  });

  it("rejects empty and oversize recordings before upload", () => {
    expect(checkRecording(0).ok).toBe(false);
    expect(checkRecording(1).ok).toBe(true);
    expect(checkRecording(MAX_UPLOAD_BYTES).ok).toBe(true);
    expect(checkRecording(MAX_UPLOAD_BYTES + 1).ok).toBe(false);
  });
});

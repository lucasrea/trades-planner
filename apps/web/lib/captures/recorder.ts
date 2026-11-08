import { audioFilename, baseAudioMime } from "@/lib/captures/audio";

/** Pure recorder helpers. No DOM, React or Next imports so they can be unit tested without a microphone. */

export const MAX_RECORDING_MS = 120_000;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** 64 kbps keeps two minutes under 1 MB, well inside the 4 MB route limit. */
export const RECORDER_BITS_PER_SECOND = 64_000;

/** Preferred first: Chrome/Firefox/Android use webm/opus, iOS Safari only supports mp4. */
const MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"] as const;

/** Returns the first supported recorder mime, or undefined to let the browser choose its default. */
export function pickRecorderMime(isTypeSupported: ((mime: string) => boolean) | undefined): string | undefined {
  if (!isTypeSupported) return undefined;
  return MIME_PREFERENCE.find((mime) => isTypeSupported(mime));
}

export function clampElapsedMs(elapsedMs: number) {
  return Math.min(Math.max(0, elapsedMs), MAX_RECORDING_MS);
}

export function hasHitRecordingCap(elapsedMs: number) {
  return elapsedMs >= MAX_RECORDING_MS;
}

/** m:ss, capped at the 2 minute limit. */
export function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(clampElapsedMs(elapsedMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Mime to label the upload with: the blob's own type when set, else what we asked the recorder for. */
export function uploadMime(blobType: string, recorderMime: string | undefined) {
  return baseAudioMime(blobType) ? blobType : (recorderMime ?? "audio/webm");
}

export function uploadFilename(mimeType: string) {
  return audioFilename(mimeType);
}

export type RecordingCheck = { ok: true } | { ok: false; message: string };

export function checkRecording(sizeBytes: number): RecordingCheck {
  if (sizeBytes < 1) return { ok: false, message: "Nothing was recorded. Try again, or type your message." };
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "That recording is too large to send. Try a shorter one, or type your message." };
  }
  return { ok: true };
}

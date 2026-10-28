const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

export type AudioValidation =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | { ok: false; status: 400 | 413; message: string };

export function baseAudioMime(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function audioFilename(mimeType: string) {
  const mime = baseAudioMime(mimeType);
  if (mime === "audio/ogg") return "capture.ogg";
  if (mime === "audio/mp4" || mime === "audio/m4a" || mime === "audio/x-m4a") return "capture.m4a";
  if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave") return "capture.wav";
  return "capture.webm";
}

export async function validateAudioFile(file: File | null): Promise<AudioValidation> {
  if (!file || file.size < 1) {
    return { ok: false, status: 400, message: "Audio file is required." };
  }
  const mimeType = baseAudioMime(file.type);
  if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
    return { ok: false, status: 400, message: "Audio must be webm, ogg, mp4, m4a, or wav." };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, message: "Audio must be 4 MB or smaller." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { ok: true, bytes, mimeType };
}

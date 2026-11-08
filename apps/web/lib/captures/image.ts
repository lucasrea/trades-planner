export const MAX_RECEIPT_IMAGE_BYTES = 4 * 1024 * 1024;

export type ReceiptImageMime = "image/jpeg" | "image/png" | "image/webp";

export type ImageValidation =
  | { ok: true; bytes: Uint8Array; mimeType: ReceiptImageMime }
  | { ok: false; status: 400 | 413; message: string };

/** Detect JPEG, PNG or WebP from the first bytes. The declared MIME type is never trusted. */
export function sniffImageMime(bytes: Uint8Array): ReceiptImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

export async function validateImageFile(file: File | null): Promise<ImageValidation> {
  if (!file || file.size < 1) {
    return { ok: false, status: 400, message: "A receipt photo is required." };
  }
  if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
    return { ok: false, status: 413, message: "Photo must be 4 MB or smaller." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageMime(bytes);
  if (!mimeType) {
    return { ok: false, status: 400, message: "Photo must be a JPEG, PNG, or WebP image." };
  }
  return { ok: true, bytes, mimeType };
}

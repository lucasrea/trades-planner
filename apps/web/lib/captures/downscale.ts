export const RECEIPT_MAX_EDGE_PX = 1600;
export const RECEIPT_JPEG_QUALITY = 0.8;

/** Scale (width, height) so the longest edge is at most maxEdge. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge = RECEIPT_MAX_EDGE_PX) {
  const longest = Math.max(width, height);
  if (!(longest > maxEdge)) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Browser only. Decode the photo, shrink it, and re-encode as JPEG before upload. */
export async function downscaleToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", RECEIPT_JPEG_QUALITY));
    if (!blob) throw new Error("Could not encode the photo.");
    return blob;
  } finally {
    bitmap.close();
  }
}

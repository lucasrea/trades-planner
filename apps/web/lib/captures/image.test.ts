import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_IMAGE_BYTES, sniffImageMime, validateImageFile } from "@/lib/captures/image";

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

function file(bytes: number[], type = "image/jpeg") {
  return new File([new Uint8Array(bytes)], "x", { type });
}

describe("receipt image validation", () => {
  it("detects JPEG, PNG and WebP by magic bytes", () => {
    expect(sniffImageMime(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffImageMime(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffImageMime(new Uint8Array(WEBP))).toBe("image/webp");
  });

  it("rejects GIF, SVG, PDF and short or empty buffers", () => {
    expect(sniffImageMime(new TextEncoder().encode("GIF89a......"))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode("<svg xmlns=''/>"))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode("%PDF-1.7 ..."))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
    // RIFF that is not WebP (e.g. WAV)
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });

  it("ignores the declared type and trusts the bytes", async () => {
    const ok = await validateImageFile(file(PNG, "image/jpeg"));
    expect(ok).toMatchObject({ ok: true, mimeType: "image/png" });
    const bad = await validateImageFile(file([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "image/jpeg"));
    expect(bad).toMatchObject({ ok: false, status: 400 });
  });

  it("requires a non-empty file", async () => {
    expect(await validateImageFile(null)).toMatchObject({ ok: false, status: 400 });
    expect(await validateImageFile(file([]))).toMatchObject({ ok: false, status: 400 });
  });

  it("allows exactly 4 MB and rejects one byte more with 413", async () => {
    const atLimit = new Uint8Array(MAX_RECEIPT_IMAGE_BYTES);
    atLimit.set(JPEG);
    expect(await validateImageFile(new File([atLimit], "a.jpg", { type: "image/jpeg" }))).toMatchObject({ ok: true });
    const over = new Uint8Array(MAX_RECEIPT_IMAGE_BYTES + 1);
    over.set(JPEG);
    expect(await validateImageFile(new File([over], "a.jpg", { type: "image/jpeg" }))).toMatchObject({ ok: false, status: 413 });
  });
});
